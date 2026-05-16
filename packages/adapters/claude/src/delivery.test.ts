import { describe, expect, it } from "vitest";
import type { WaypointHint } from "@waypoint/core";
import { appendHintToNextUserMessage } from "./delivery.js";
import {
	baseDeliveryContext,
	emptyTrailingUserContext,
	noUserMessageContext,
} from "./fixtures.js";

function makeHint(content: string): WaypointHint {
	return {
		id: "hint-test",
		caseId: "case-test",
		content,
		deliveryMode: "append",
		quality: { signalCreation: 0.5, signalTransfer: 0.5, confidence: 0.5 },
		targetConcept: "zero-divisor guard",
		playbookBulletIds: [],
		recommendation: "hint",
		createdAt: new Date(),
	};
}

describe("appendHintToNextUserMessage", () => {
	it("appends hint after a blank line on the trailing user message", () => {
		const hint = makeHint(
			"Consider whether divide should treat zero divisors as a domain error."
		);
		const updated = appendHintToNextUserMessage(hint, baseDeliveryContext);

		const last = updated.messages[updated.messages.length - 1];
		expect(last?.role).toBe("user");
		expect(last?.content).toBe(
			"It still fails.\n\nConsider whether divide should treat zero divisors as a domain error."
		);
		// Blank line — exactly one — separates the two parts.
		expect(last?.content.split("\n\n")).toHaveLength(2);
	});

	it("does not add any framing words like 'hint' around the hint text", () => {
		const hint = makeHint("Parameterize the query instead of interpolating.");
		const updated = appendHintToNextUserMessage(hint, baseDeliveryContext);
		const last = updated.messages[updated.messages.length - 1]!;

		const appended = last.content.slice("It still fails.\n\n".length);
		expect(appended).toBe("Parameterize the query instead of interpolating.");
		// No framing prefix anywhere on the appended portion.
		expect(appended.toLowerCase().startsWith("here is a hint")).toBe(false);
		expect(appended.toLowerCase().startsWith("hint:")).toBe(false);
		expect(appended.toLowerCase()).not.toContain("here is a hint");
	});

	it("replaces an empty trailing user message with just the hint", () => {
		const hint = makeHint("Look at the off-by-one in the loop bound.");
		const updated = appendHintToNextUserMessage(hint, emptyTrailingUserContext);
		const last = updated.messages[updated.messages.length - 1];

		expect(last?.role).toBe("user");
		expect(last?.content).toBe("Look at the off-by-one in the loop bound.");
	});

	it("appends a new user message when no user message exists yet", () => {
		const hint = makeHint("Start by reading the failing test.");
		const updated = appendHintToNextUserMessage(hint, noUserMessageContext);

		expect(updated.messages).toHaveLength(2);
		const last = updated.messages[updated.messages.length - 1];
		expect(last).toEqual({
			role: "user",
			content: "Start by reading the failing test.",
		});
	});

	it("does not mutate the input context", () => {
		const hint = makeHint("Try again with bounds checking.");
		const before = JSON.stringify(baseDeliveryContext);
		appendHintToNextUserMessage(hint, baseDeliveryContext);
		expect(JSON.stringify(baseDeliveryContext)).toBe(before);
	});
});
