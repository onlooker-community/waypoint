import type {
	WaypointAdapter,
	AdapterContext,
	ReasonerInfo,
	WaypointCase,
	WaypointHint,
	HintOutcome,
} from "@waypoint/core";
import { HintOutcomeSchema } from "@waypoint/core";
import { extractAssistantText, parseClaudeFailure } from "./parser.js";
import { appendHintToNextUserMessage } from "./delivery.js";
import { scanAssistantTextForHintReference } from "./outcome.js";
import type {
	AnthropicMessageResponse,
	ClaudeMessageContext,
	ClaudeOutcomeEvent,
} from "./types.js";

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isAnthropicResponse(value: unknown): value is AnthropicMessageResponse {
	return isObject(value) && Array.isArray((value as { content?: unknown }).content);
}

export class ClaudeAdapter implements WaypointAdapter {
	readonly id = "claude";
	readonly version = "0.1.0";

	parseFailure(rawEvent: unknown): WaypointCase {
		return parseClaudeFailure(rawEvent);
	}

	async deliverHint(hint: WaypointHint, context: AdapterContext): Promise<void> {
		const raw = context.raw as ClaudeMessageContext | undefined;
		if (!raw || !Array.isArray(raw.messages)) {
			throw new Error("ClaudeAdapter.deliverHint requires context.raw.messages");
		}

		// Mutate the original context payload so host integrations can forward it
		// directly to the next Anthropic call without re-wrapping.
		context.raw = appendHintToNextUserMessage(hint, raw);
	}

	parseOutcome(rawEvent: unknown): HintOutcome {
		if (!isObject(rawEvent)) {
			throw new Error("ClaudeAdapter.parseOutcome expected an object event");
		}

		const event = rawEvent as unknown as ClaudeOutcomeEvent;

		// Prefer the host's explicit signal; otherwise scan the assistant text
		// for reference phrases. If neither is available, default to `false`.
		let hintReferenced: boolean;
		if (typeof event.hintReferenced === "boolean") {
			hintReferenced = event.hintReferenced;
		} else if (event.response && isAnthropicResponse(event.response)) {
			hintReferenced = scanAssistantTextForHintReference(
				extractAssistantText(event.response)
			);
		} else if (typeof event.finalOutput === "string") {
			hintReferenced = scanAssistantTextForHintReference(event.finalOutput);
		} else {
			hintReferenced = false;
		}

		return HintOutcomeSchema.parse({
			hintId: event.hintId,
			caseId: event.caseId,
			succeeded: event.succeeded,
			hintReferenced,
			attemptsAfterHint: event.attemptsAfterHint,
			...(event.finalOutput !== undefined ? { finalOutput: event.finalOutput } : {}),
			...(event.timeToSuccessMs !== undefined
				? { timeToSuccessMs: event.timeToSuccessMs }
				: {}),
			recordedAt: new Date(),
		});
	}

	getReasonerInfo(): ReasonerInfo {
		return {
			modelId: "claude-sonnet-4-20250514",
			provider: "anthropic",
			contextWindow: 200000,
			// Anthropic's Messages API does not expose token log probabilities,
			// so reliance measurement must fall back to the judge model.
			supportsLogProbs: false,
		};
	}
}

export { parseClaudeFailure, extractAssistantText } from "./parser.js";
export { appendHintToNextUserMessage } from "./delivery.js";
export {
	scanAssistantTextForHintReference,
	HINT_REFERENCE_PHRASES,
} from "./outcome.js";
export type {
	AnthropicContentBlock,
	AnthropicMessageResponse,
	AnthropicStopReason,
	AnthropicTextBlock,
	AnthropicToolResultBlock,
	AnthropicToolUseBlock,
	ClaudeFailureEvent,
	ClaudeMessageContext,
	ClaudeOutcomeEvent,
	ClaudeRawApiFailure,
	ClaudeRetryExhaustedEvent,
	ClaudeTaskType,
	ClaudeToolErrorEvent,
	ClaudeVerifierFailureEvent,
} from "./types.js";
