import { describe, expect, it } from "vitest";
import type { AdapterContext, WaypointHint } from "@waypoint/core";
import { ClaudeAdapter } from "./index.js";
import {
	baseDeliveryContext,
	makeOutcomeEvent,
	mixedCaseOutcomeResponse,
	negativeOutcomeResponse,
	positiveOutcomeResponse,
	toolErrorRawFailure,
} from "./fixtures.js";

function makeHint(content: string): WaypointHint {
	return {
		id: "hint-1",
		caseId: "case-1",
		content,
		deliveryMode: "append",
		quality: { signalCreation: 0.5, signalTransfer: 0.5, confidence: 0.5 },
		targetConcept: "test concept",
		playbookBulletIds: [],
		recommendation: "hint",
		createdAt: new Date(),
	};
}

describe("ClaudeAdapter", () => {
	it("exposes stable id and version", () => {
		const adapter = new ClaudeAdapter();
		expect(adapter.id).toBe("claude");
		expect(typeof adapter.version).toBe("string");
	});

	describe("parseFailure", () => {
		it("delegates to parseClaudeFailure for raw API failures", () => {
			const adapter = new ClaudeAdapter();
			const result = adapter.parseFailure(toolErrorRawFailure);
			expect(result.attempt.failureSignal).toContain("Tool call failed");
		});
	});

	describe("deliverHint", () => {
		it("mutates context.raw with the hint appended to the trailing user message", async () => {
			const adapter = new ClaudeAdapter();
			const context: AdapterContext = {
				// Clone so we don't pollute the shared fixture.
				raw: JSON.parse(JSON.stringify(baseDeliveryContext)),
				sessionId: "sess-1",
				agentId: "agent-1",
			};

			await adapter.deliverHint(
				makeHint("Check the zero-divisor branch."),
				context
			);

			const raw = context.raw as typeof baseDeliveryContext;
			const last = raw.messages[raw.messages.length - 1];
			expect(last?.content).toBe(
				"It still fails.\n\nCheck the zero-divisor branch."
			);
		});

		it("throws when context.raw is missing messages", async () => {
			const adapter = new ClaudeAdapter();
			const context: AdapterContext = {
				raw: {},
				sessionId: "sess-1",
				agentId: "agent-1",
			};
			await expect(
				adapter.deliverHint(makeHint("anything"), context)
			).rejects.toThrow(/messages/);
		});
	});

	describe("parseOutcome", () => {
		it("detects hintReferenced=true when assistant text contains a phrase", () => {
			const adapter = new ClaudeAdapter();
			const outcome = adapter.parseOutcome(
				makeOutcomeEvent({ response: positiveOutcomeResponse })
			);
			expect(outcome.hintReferenced).toBe(true);
			expect(outcome.succeeded).toBe(true);
			expect(outcome.recordedAt).toBeInstanceOf(Date);
		});

		it("returns hintReferenced=false when no phrase is present", () => {
			const adapter = new ClaudeAdapter();
			const outcome = adapter.parseOutcome(
				makeOutcomeEvent({ response: negativeOutcomeResponse })
			);
			expect(outcome.hintReferenced).toBe(false);
		});

		it("matches phrases case-insensitively", () => {
			const adapter = new ClaudeAdapter();
			const outcome = adapter.parseOutcome(
				makeOutcomeEvent({ response: mixedCaseOutcomeResponse })
			);
			expect(outcome.hintReferenced).toBe(true);
		});

		it("falls back to finalOutput text when no response is provided", () => {
			const adapter = new ClaudeAdapter();
			const outcome = adapter.parseOutcome(
				makeOutcomeEvent({
					finalOutput: "As suggested, I'll wrap the call in a try/catch.",
				})
			);
			expect(outcome.hintReferenced).toBe(true);
		});

		it("respects an explicit hintReferenced override on the event", () => {
			const adapter = new ClaudeAdapter();
			const outcome = adapter.parseOutcome(
				makeOutcomeEvent({
					hintReferenced: false,
					// Text would match, but the explicit flag wins.
					response: positiveOutcomeResponse,
				})
			);
			expect(outcome.hintReferenced).toBe(false);
		});

		it("throws on non-object input", () => {
			const adapter = new ClaudeAdapter();
			expect(() => adapter.parseOutcome("nope")).toThrow();
		});
	});

	describe("getReasonerInfo", () => {
		it("returns supportsLogProbs: false because Anthropic does not expose log probs", () => {
			const adapter = new ClaudeAdapter();
			const info = adapter.getReasonerInfo();
			expect(info.supportsLogProbs).toBe(false);
			expect(info.provider).toBe("anthropic");
			expect(info.contextWindow).toBeGreaterThan(0);
			expect(typeof info.modelId).toBe("string");
		});
	});
});
