// Test fixtures shaped like real Anthropic Messages API responses (and the
// adapter's pre-classified event variants). These are imported by the unit
// tests under this package — no real API calls are ever made.

import type {
	AnthropicMessageResponse,
	ClaudeFailureEvent,
	ClaudeMessageContext,
	ClaudeOutcomeEvent,
	ClaudeRawApiFailure,
} from "./types.js";

// --- Raw Anthropic response fixtures ------------------------------------

export const toolErrorResponse: AnthropicMessageResponse = {
	id: "msg_test_tool_error",
	role: "assistant",
	model: "claude-sonnet-4-20250514",
	stop_reason: "tool_use",
	stop_sequence: null,
	content: [
		{
			type: "text",
			text: "I'll read the file to inspect the failing test.",
		},
		{
			type: "tool_use",
			id: "toolu_01ABCD",
			name: "read_file",
			input: { path: "src/missing.ts" },
		},
		{
			type: "tool_result",
			tool_use_id: "toolu_01ABCD",
			is_error: true,
			content: "ENOENT: no such file or directory, open 'src/missing.ts'",
		},
	],
};

export const toolErrorRawFailure: ClaudeRawApiFailure = {
	response: toolErrorResponse,
	task: "Add a unit test for the divide function",
	context: "User is iterating on packages/math/src/divide.ts",
	successCriteria: "vitest run packages/math passes",
	attemptNumber: 2,
	agentId: "agent-42",
	sessionId: "sess-7",
};

export const verifierFailureResponse: AnthropicMessageResponse = {
	id: "msg_test_verifier",
	role: "assistant",
	model: "claude-sonnet-4-20250514",
	stop_reason: "end_turn",
	stop_sequence: null,
	content: [
		{
			type: "text",
			text:
				"I implemented the divide function with a guard for zero divisors.",
		},
		{
			type: "tool_use",
			id: "toolu_test_run",
			name: "bash",
			input: { command: "npm test" },
		},
		{
			type: "tool_result",
			tool_use_id: "toolu_test_run",
			is_error: false,
			content: [
				{
					type: "text",
					text:
						"FAIL packages/math/src/divide.test.ts\n  expected divide(10, 0) to throw, got Infinity",
				},
			],
		},
	],
};

export const verifierRawFailure: ClaudeRawApiFailure = {
	response: verifierFailureResponse,
	task: "Make divide throw on zero divisor",
	context: "Test file already exists; update divide.ts",
	verifier: {
		name: "vitest",
		output:
			"FAIL packages/math/src/divide.test.ts\n  expected divide(10, 0) to throw",
		reason: "test expected throw but got Infinity",
	},
	attemptNumber: 1,
};

export const retryExhaustedResponse: AnthropicMessageResponse = {
	id: "msg_test_max_tokens",
	role: "assistant",
	model: "claude-sonnet-4-20250514",
	stop_reason: "max_tokens",
	stop_sequence: null,
	content: [
		{
			type: "text",
			text:
				"Continuing to analyse the failing test... let me check the imports again and",
		},
	],
};

export const retryExhaustedRawFailure: ClaudeRawApiFailure = {
	response: retryExhaustedResponse,
	task: "Refactor the parser to handle nested groups",
	attempts: 5,
	maxAttempts: 5,
};

// --- Pre-classified discriminated event fixtures ------------------------

export const toolErrorEvent: ClaudeFailureEvent = {
	kind: "tool_error",
	toolName: "read_file",
	error: "ENOENT: no such file or directory",
	input: "I'll read src/missing.ts to inspect the failure.",
	task: "Add a unit test for the divide function",
	taskType: "code",
	attemptNumber: 2,
	agentId: "agent-42",
	sessionId: "sess-7",
};

export const verifierFailureEvent: ClaudeFailureEvent = {
	kind: "verifier_failed",
	verifierName: "vitest",
	reason: "test expected throw but got Infinity",
	output:
		"FAIL packages/math/src/divide.test.ts\n  expected divide(10, 0) to throw",
	task: "Make divide throw on zero divisor",
	taskType: "code",
	attemptNumber: 1,
};

export const retryExhaustedEvent: ClaudeFailureEvent = {
	kind: "retries_exhausted",
	reason: "stop_reason=max_tokens after 5 attempts",
	attempts: 5,
	lastOutput: "Continuing to analyse the failing test...",
	task: "Refactor the parser to handle nested groups",
	taskType: "code",
};

// --- Delivery context fixtures ------------------------------------------

export const baseDeliveryContext: ClaudeMessageContext = {
	messages: [
		{ role: "system", content: "You are a careful coding assistant." },
		{ role: "user", content: "Please fix the failing divide test." },
		{
			role: "assistant",
			content: "I'll guard against zero divisors and re-run the suite.",
		},
		{ role: "user", content: "It still fails." },
	],
};

export const emptyTrailingUserContext: ClaudeMessageContext = {
	messages: [
		{ role: "system", content: "You are a careful coding assistant." },
		{ role: "user", content: "" },
	],
};

export const noUserMessageContext: ClaudeMessageContext = {
	messages: [{ role: "system", content: "You are a careful coding assistant." }],
};

// --- Outcome event fixtures ---------------------------------------------

export function makeOutcomeEvent(
	overrides: Partial<ClaudeOutcomeEvent> = {}
): ClaudeOutcomeEvent {
	return {
		kind: "outcome",
		hintId: "hint-1",
		caseId: "case-1",
		succeeded: true,
		attemptsAfterHint: 1,
		...overrides,
	};
}

export const positiveOutcomeResponse: AnthropicMessageResponse = {
	id: "msg_outcome_positive",
	role: "assistant",
	model: "claude-sonnet-4-20250514",
	stop_reason: "end_turn",
	stop_sequence: null,
	content: [
		{
			type: "text",
			text:
				"As suggested, I added a guard for zero divisors and the suite now passes.",
		},
	],
};

export const negativeOutcomeResponse: AnthropicMessageResponse = {
	id: "msg_outcome_negative",
	role: "assistant",
	model: "claude-sonnet-4-20250514",
	stop_reason: "end_turn",
	stop_sequence: null,
	content: [
		{
			type: "text",
			text: "I refactored the divide implementation and all tests pass.",
		},
	],
};

export const mixedCaseOutcomeResponse: AnthropicMessageResponse = {
	id: "msg_outcome_mixed_case",
	role: "assistant",
	model: "claude-sonnet-4-20250514",
	stop_reason: "end_turn",
	stop_sequence: null,
	content: [
		{
			type: "text",
			text: "FOLLOWING THE HINT, I parameterized the query and the leak is gone.",
		},
	],
};
