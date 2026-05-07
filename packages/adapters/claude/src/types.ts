export type ClaudeTaskType = "code" | "reasoning" | "writing" | "general";

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
	hintReferenced: boolean;
	attemptsAfterHint: number;
	finalOutput?: string;
	timeToSuccessMs?: number;
}

export type ClaudeFailureEvent =
	| ClaudeToolErrorEvent
	| ClaudeVerifierFailureEvent
	| ClaudeRetryExhaustedEvent;
