import { WaypointCaseSchema, type WaypointCase } from "@waypoint/core";
import type { ClaudeFailureEvent } from "./types.js";

function asFailureEvent(rawEvent: unknown): ClaudeFailureEvent {
	if (!rawEvent || typeof rawEvent !== "object") {
		throw new Error("ClaudeAdapter.parseFailure expected an object event");
	}

	const kind = (rawEvent as { kind?: unknown }).kind;
	if (
		kind !== "tool_error" &&
		kind !== "verifier_failed" &&
		kind !== "retries_exhausted"
	) {
		throw new Error(`Unsupported Claude failure event kind: ${String(kind)}`);
	}

	return rawEvent as ClaudeFailureEvent;
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

export function parseClaudeFailure(rawEvent: unknown): WaypointCase {
	const event = asFailureEvent(rawEvent);

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
			context: event.context,
			successCriteria: event.successCriteria,
		},
		attempt: {
			content: attemptContentFor(event),
			failureSignal: failureSignalFor(event),
			attemptNumber,
			timestamp: new Date(),
		},
		agentId: event.agentId,
		sessionId: event.sessionId,
	});
}
