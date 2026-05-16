import { describe, expect, it } from "vitest";
import { parseClaudeFailure } from "./parser.js";
import {
	retryExhaustedEvent,
	retryExhaustedRawFailure,
	retryExhaustedResponse,
	toolErrorEvent,
	toolErrorRawFailure,
	toolErrorResponse,
	verifierFailureEvent,
	verifierFailureResponse,
	verifierRawFailure,
} from "./fixtures.js";

describe("parseClaudeFailure — discriminated events", () => {
	it("maps tool_error events to a WaypointCase", () => {
		const result = parseClaudeFailure(toolErrorEvent);

		expect(result.task.content).toBe(
			"Add a unit test for the divide function"
		);
		expect(result.task.type).toBe("code");
		expect(result.attempt.failureSignal).toContain("Tool call failed (read_file)");
		expect(result.attempt.failureSignal).toContain("ENOENT");
		expect(result.attempt.attemptNumber).toBe(2);
		expect(result.agentId).toBe("agent-42");
		expect(result.sessionId).toBe("sess-7");
	});

	it("maps verifier_failed events to a WaypointCase", () => {
		const result = parseClaudeFailure(verifierFailureEvent);

		expect(result.attempt.failureSignal).toContain("Verifier failed (vitest)");
		expect(result.attempt.content).toContain("FAIL");
		expect(result.task.type).toBe("code");
	});

	it("maps retries_exhausted events and clamps attemptNumber to attempts", () => {
		const result = parseClaudeFailure(retryExhaustedEvent);

		expect(result.attempt.failureSignal).toContain(
			"Agentic loop exhausted retries (5)"
		);
		expect(result.attempt.attemptNumber).toBe(5);
		expect(result.attempt.content).toContain("Continuing to analyse");
	});
});

describe("parseClaudeFailure — raw Anthropic responses", () => {
	it("detects tool errors via is_error tool_result blocks", () => {
		const result = parseClaudeFailure(toolErrorRawFailure);

		expect(result.attempt.failureSignal).toContain("Tool call failed (read_file)");
		expect(result.attempt.failureSignal).toContain("ENOENT");
		// Assistant text should be carried into attempt.content
		expect(result.attempt.content).toContain("read the file");
		// Tool name "read_file" should infer code task type
		expect(result.task.type).toBe("code");
		expect(result.attempt.attemptNumber).toBe(2);
		expect(result.task.successCriteria).toBe("vitest run packages/math passes");
	});

	it("uses verifier sidecar when present", () => {
		const result = parseClaudeFailure(verifierRawFailure);

		expect(result.attempt.failureSignal).toContain("Verifier failed (vitest)");
		expect(result.attempt.failureSignal).toContain("expected throw");
	});

	it("treats stop_reason=max_tokens as retry exhaustion", () => {
		const result = parseClaudeFailure(retryExhaustedRawFailure);

		expect(result.attempt.failureSignal).toContain("exhausted retries (5)");
		expect(result.attempt.failureSignal).toContain("max_tokens");
		expect(result.attempt.attemptNumber).toBe(5);
	});

	it("accepts a bare Anthropic response object", () => {
		const result = parseClaudeFailure(retryExhaustedResponse);

		expect(result.attempt.failureSignal).toContain("max_tokens");
		expect(result.task.content).toContain("Task context unavailable");
	});

	it("falls back to a generic signal when no specific failure shape is detected", () => {
		const result = parseClaudeFailure({
			...verifierFailureResponse,
			content: [
				{ type: "text", text: "I am thinking but produced nothing actionable." },
			],
			stop_reason: "end_turn",
		});

		expect(result.attempt.failureSignal).toContain("Claude response failed");
		expect(result.attempt.content).toContain("thinking");
	});

	it("infers task.type='code' from code-leaning tool names", () => {
		const result = parseClaudeFailure(toolErrorResponse);
		expect(result.task.type).toBe("code");
	});
});

describe("parseClaudeFailure — error handling", () => {
	it("rejects non-object input", () => {
		expect(() => parseClaudeFailure("nope")).toThrow();
		expect(() => parseClaudeFailure(null)).toThrow();
		expect(() => parseClaudeFailure(undefined)).toThrow();
	});

	it("rejects unrecognized object shapes", () => {
		expect(() => parseClaudeFailure({ foo: "bar" })).toThrow(
			/unrecognized event shape/i
		);
	});
});
