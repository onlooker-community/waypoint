import { describe, expect, it } from "vitest";
import {
	HINT_REFERENCE_PHRASES,
	scanAssistantTextForHintReference,
} from "./outcome.js";

describe("scanAssistantTextForHintReference", () => {
	it("matches 'as suggested' (case-insensitive)", () => {
		expect(
			scanAssistantTextForHintReference(
				"As suggested, I added a guard for zero divisors."
			)
		).toBe(true);
		expect(
			scanAssistantTextForHintReference("AS SUGGESTED, here is the fix.")
		).toBe(true);
	});

	it("matches 'following the hint'", () => {
		expect(
			scanAssistantTextForHintReference(
				"Following the hint, I parameterized the SQL."
			)
		).toBe(true);
	});

	it("matches 'as mentioned'", () => {
		expect(
			scanAssistantTextForHintReference(
				"As mentioned earlier, the loop is off by one."
			)
		).toBe(true);
	});

	it("returns false when no reference phrase is present", () => {
		expect(
			scanAssistantTextForHintReference(
				"I refactored the divide implementation and all tests now pass."
			)
		).toBe(false);
	});

	it("returns false for empty or non-string input", () => {
		expect(scanAssistantTextForHintReference("")).toBe(false);
		// Force a non-string at runtime to confirm the guard.
		expect(
			scanAssistantTextForHintReference(undefined as unknown as string)
		).toBe(false);
	});

	it("exposes a stable, non-empty phrase list", () => {
		expect(HINT_REFERENCE_PHRASES.length).toBeGreaterThan(0);
		expect(HINT_REFERENCE_PHRASES).toContain("as suggested");
		expect(HINT_REFERENCE_PHRASES).toContain("following the hint");
		expect(HINT_REFERENCE_PHRASES).toContain("as mentioned");
	});
});
