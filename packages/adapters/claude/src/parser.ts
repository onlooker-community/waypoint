import { WaypointCaseSchema, type WaypointCase } from "@waypoint/core";
import type {
	AnthropicContentBlock,
	AnthropicMessageResponse,
	AnthropicTextBlock,
	AnthropicToolResultBlock,
	AnthropicToolUseBlock,
	ClaudeFailureEvent,
	ClaudeRawApiFailure,
	ClaudeTaskType,
} from "./types.js";

// --- Type guards --------------------------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isAnthropicResponse(value: unknown): value is AnthropicMessageResponse {
	if (!isObject(value)) return false;
	return Array.isArray((value as { content?: unknown }).content);
}

function isRawApiFailure(value: unknown): value is ClaudeRawApiFailure {
	if (!isObject(value)) return false;
	return isAnthropicResponse((value as { response?: unknown }).response);
}

function isTextBlock(block: AnthropicContentBlock): block is AnthropicTextBlock {
	return block.type === "text";
}

function isToolUseBlock(
	block: AnthropicContentBlock
): block is AnthropicToolUseBlock {
	return block.type === "tool_use";
}

function isToolResultBlock(
	block: AnthropicContentBlock
): block is AnthropicToolResultBlock {
	return block.type === "tool_result";
}

// --- Anthropic response helpers -----------------------------------------

const CODE_TOOL_HINTS = [
	"bash",
	"shell",
	"exec",
	"run_command",
	"read_file",
	"write_file",
	"edit_file",
	"str_replace",
	"create_file",
	"file_",
	"code_",
];

function flattenToolResult(block: AnthropicToolResultBlock): string {
	if (typeof block.content === "string") return block.content;
	return block.content
		.map((part) => (part.type === "text" ? part.text : ""))
		.join("\n")
		.trim();
}

function collectAssistantText(response: AnthropicMessageResponse): string {
	return response.content
		.filter(isTextBlock)
		.map((block) => block.text)
		.join("\n")
		.trim();
}

function findFirstToolUseName(
	response: AnthropicMessageResponse
): string | undefined {
	const block = response.content.find(isToolUseBlock);
	return block?.name;
}

function findErrorToolResult(
	response: AnthropicMessageResponse
): AnthropicToolResultBlock | undefined {
	return response.content
		.filter(isToolResultBlock)
		.find((block) => block.is_error === true);
}

function inferTaskType(
	response: AnthropicMessageResponse,
	explicit: ClaudeTaskType | undefined
): ClaudeTaskType {
	if (explicit) return explicit;
	const toolNames = response.content
		.filter(isToolUseBlock)
		.map((block) => block.name.toLowerCase());
	if (toolNames.some((name) => CODE_TOOL_HINTS.some((hint) => name.includes(hint)))) {
		return "code";
	}
	return "general";
}

// --- Discriminated event handling ---------------------------------------

function isClaudeFailureEvent(value: unknown): value is ClaudeFailureEvent {
	if (!isObject(value)) return false;
	const kind = (value as { kind?: unknown }).kind;
	return (
		kind === "tool_error" ||
		kind === "verifier_failed" ||
		kind === "retries_exhausted"
	);
}

function failureSignalFor(event: ClaudeFailureEvent): string {
	switch (event.kind) {
		case "tool_error":
			return `Tool call failed (${event.toolName}): ${event.error}`;
		case "verifier_failed":
			return `Verifier failed (${event.verifierName}): ${event.reason}`;
		case "retries_exhausted":
			return `Agentic loop exhausted retries (${event.attempts}): ${event.reason}`;
	}
}

function attemptContentFor(event: ClaudeFailureEvent): string {
	switch (event.kind) {
		case "tool_error":
			return event.input ?? "Tool invocation failed before producing usable output.";
		case "verifier_failed":
			return event.output;
		case "retries_exhausted":
			return event.lastOutput ?? "No final output captured before retries were exhausted.";
	}
}

function fromDiscriminatedEvent(event: ClaudeFailureEvent): WaypointCase {
	const taskContent = event.task ?? "Task context unavailable from Claude event.";
	const taskType = event.taskType ?? "general";
	const attemptNumber =
		event.kind === "retries_exhausted"
			? Math.max(1, event.attempts)
			: Math.max(1, event.attemptNumber ?? 1);

	return WaypointCaseSchema.parse({
		id: crypto.randomUUID(),
		task: {
			content: taskContent,
			type: taskType,
			...(event.context !== undefined ? { context: event.context } : {}),
			...(event.successCriteria !== undefined
				? { successCriteria: event.successCriteria }
				: {}),
		},
		attempt: {
			content: attemptContentFor(event),
			failureSignal: failureSignalFor(event),
			attemptNumber,
			timestamp: new Date(),
		},
		...(event.agentId !== undefined ? { agentId: event.agentId } : {}),
		...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
	});
}

// --- Anthropic-shaped event handling ------------------------------------
//
// "Retry exhaustion" is treated as `stop_reason === "max_tokens"` or an
// explicit `attempts >= maxAttempts` on the sidecar. This is a structural
// judgement call: the Anthropic API has no native "retries exhausted" stop
// reason — agentic loops are host-orchestrated — so we accept whichever of
// these signals the host provides.

function fromRawApiFailure(raw: ClaudeRawApiFailure): WaypointCase {
	const { response } = raw;
	const assistantText = collectAssistantText(response);
	const errorResult = findErrorToolResult(response);
	const toolUseName = findFirstToolUseName(response);

	const retriesExhausted =
		response.stop_reason === "max_tokens" ||
		(typeof raw.attempts === "number" &&
			typeof raw.maxAttempts === "number" &&
			raw.attempts >= raw.maxAttempts);

	let failureSignal: string;
	let attemptContent: string;

	if (errorResult) {
		const errorText = flattenToolResult(errorResult);
		failureSignal = `Tool call failed${
			toolUseName ? ` (${toolUseName})` : ""
		}: ${errorText || "tool reported is_error=true"}`;
		attemptContent =
			assistantText.length > 0
				? assistantText
				: "Assistant produced no text before the tool error.";
	} else if (raw.verifier) {
		failureSignal = `Verifier failed (${raw.verifier.name}): ${
			raw.verifier.reason ?? raw.verifier.output
		}`;
		attemptContent = assistantText.length > 0 ? assistantText : raw.verifier.output;
	} else if (retriesExhausted) {
		const attempts = raw.attempts ?? raw.maxAttempts ?? 1;
		failureSignal = `Agentic loop exhausted retries (${attempts}): stop_reason=${
			response.stop_reason ?? "unknown"
		}`;
		attemptContent =
			assistantText.length > 0
				? assistantText
				: "No final output captured before retries were exhausted.";
	} else {
		// Fall back to whatever assistant text exists with a generic signal.
		failureSignal = `Claude response failed: stop_reason=${
			response.stop_reason ?? "unknown"
		}`;
		attemptContent =
			assistantText.length > 0
				? assistantText
				: "Assistant produced no usable output.";
	}

	const taskType = inferTaskType(response, raw.taskType);
	const attemptNumber = Math.max(
		1,
		raw.attemptNumber ?? raw.attempts ?? 1
	);

	return WaypointCaseSchema.parse({
		id: crypto.randomUUID(),
		task: {
			content: raw.task ?? "Task context unavailable from Claude API response.",
			type: taskType,
			...(raw.context !== undefined ? { context: raw.context } : {}),
			...(raw.successCriteria !== undefined
				? { successCriteria: raw.successCriteria }
				: {}),
		},
		attempt: {
			content: attemptContent,
			failureSignal,
			attemptNumber,
			timestamp: new Date(),
		},
		...(raw.agentId !== undefined ? { agentId: raw.agentId } : {}),
		...(raw.sessionId !== undefined ? { sessionId: raw.sessionId } : {}),
	});
}

// --- Public entry point -------------------------------------------------

export function parseClaudeFailure(rawEvent: unknown): WaypointCase {
	if (!isObject(rawEvent)) {
		throw new Error("ClaudeAdapter.parseFailure expected an object event");
	}

	if (isClaudeFailureEvent(rawEvent)) {
		return fromDiscriminatedEvent(rawEvent);
	}

	if (isRawApiFailure(rawEvent)) {
		return fromRawApiFailure(rawEvent);
	}

	if (isAnthropicResponse(rawEvent)) {
		return fromRawApiFailure({ response: rawEvent });
	}

	throw new Error(
		"ClaudeAdapter.parseFailure: unrecognized event shape. " +
			"Expected a discriminated ClaudeFailureEvent or an Anthropic Messages response."
	);
}

// Exported for use by `parseOutcome` so the two methods share one definition
// of "what the assistant said".
export function extractAssistantText(response: AnthropicMessageResponse): string {
	return collectAssistantText(response);
}
