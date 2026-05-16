// Public types for the Claude adapter.
//
// The adapter accepts two flavors of `rawEvent`:
//   1. A pre-normalized event object with a `kind` discriminator
//      (`tool_error`, `verifier_failed`, `retries_exhausted`, `outcome`).
//      Hosts that already classify their own failures can pass these directly.
//   2. A raw Anthropic Messages API response, recognized structurally
//      (e.g. via `stop_reason`, `content` blocks with `tool_use_id` + `is_error`).
//      The adapter inspects the response and infers the failure shape.

export type ClaudeTaskType = "code" | "reasoning" | "writing" | "general";

// --- Normalized / pre-classified events ---------------------------------

export interface ClaudeToolErrorEvent {
	kind: "tool_error";
	toolName: string;
	error: string;
	input?: string;
	task?: string;
	taskType?: ClaudeTaskType;
	successCriteria?: string;
	context?: string;
	attemptNumber?: number;
	agentId?: string;
	sessionId?: string;
}

export interface ClaudeVerifierFailureEvent {
	kind: "verifier_failed";
	verifierName: string;
	reason: string;
	output: string;
	task?: string;
	taskType?: ClaudeTaskType;
	successCriteria?: string;
	context?: string;
	attemptNumber?: number;
	agentId?: string;
	sessionId?: string;
}

export interface ClaudeRetryExhaustedEvent {
	kind: "retries_exhausted";
	reason: string;
	attempts: number;
	lastOutput?: string;
	task?: string;
	taskType?: ClaudeTaskType;
	successCriteria?: string;
	context?: string;
	agentId?: string;
	sessionId?: string;
}

export type ClaudeFailureEvent =
	| ClaudeToolErrorEvent
	| ClaudeVerifierFailureEvent
	| ClaudeRetryExhaustedEvent;

// --- Delivery + outcome shapes ------------------------------------------

export interface ClaudeMessageContext {
	messages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>;
}

export interface ClaudeOutcomeEvent {
	kind: "outcome";
	hintId: string;
	caseId: string;
	succeeded: boolean;
	// Optional — when omitted the adapter scans the assistant text for
	// reference phrases like "as suggested" / "following the hint" /
	// "as mentioned". Hosts that already know the answer (e.g. by tagging
	// the hint themselves) can pass it explicitly.
	hintReferenced?: boolean;
	attemptsAfterHint: number;
	finalOutput?: string;
	timeToSuccessMs?: number;

	// Anthropic-shaped response — used to scan for reference phrases
	// when `hintReferenced` is not pre-set.
	response?: AnthropicMessageResponse;
}

// --- Raw Anthropic Messages API shapes (subset we look at) --------------
//
// We mirror only the fields the adapter needs. The full SDK types live in
// `@anthropic-ai/sdk`; we intentionally do not depend on it — the adapter
// reshapes structs, the host calls the API.

export interface AnthropicTextBlock {
	type: "text";
	text: string;
}

export interface AnthropicToolUseBlock {
	type: "tool_use";
	id: string;
	name: string;
	input: unknown;
}

export interface AnthropicToolResultBlock {
	type: "tool_result";
	tool_use_id: string;
	content:
		| string
		| Array<{ type: "text"; text: string }>;
	is_error?: boolean;
}

export type AnthropicContentBlock =
	| AnthropicTextBlock
	| AnthropicToolUseBlock
	| AnthropicToolResultBlock;

export type AnthropicStopReason =
	| "end_turn"
	| "max_tokens"
	| "stop_sequence"
	| "tool_use"
	| "refusal"
	| (string & {});

export interface AnthropicMessageResponse {
	id?: string;
	role?: "assistant";
	model?: string;
	stop_reason?: AnthropicStopReason | null;
	stop_sequence?: string | null;
	content: AnthropicContentBlock[];
}

// A raw Anthropic-shaped failure that the adapter can interpret directly.
// Optional sidecar fields let the host attach task / verifier metadata
// without re-classifying into one of the discriminated `kind`s above.
export interface ClaudeRawApiFailure {
	response: AnthropicMessageResponse;
	task?: string;
	taskType?: ClaudeTaskType;
	context?: string;
	successCriteria?: string;
	attemptNumber?: number;
	attempts?: number;
	maxAttempts?: number;
	agentId?: string;
	sessionId?: string;
	verifier?: {
		name: string;
		output: string;
		reason?: string;
	};
}
