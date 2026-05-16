// Detects whether an assistant response explicitly references a hint.
//
// High `hintReferenced` rates across sessions are a signal that hints are
// too prescriptive — the model is leaning on them rather than reasoning
// independently. We deliberately match conservative, common phrasings so
// the rate stays meaningful.

const REFERENCE_PHRASES: readonly string[] = [
	"as suggested",
	"as you suggested",
	"following the hint",
	"following your hint",
	"as mentioned",
	"as you mentioned",
	"as hinted",
	"per the hint",
	"per your hint",
	"based on the hint",
	"using the hint",
];

export function scanAssistantTextForHintReference(text: string): boolean {
	if (typeof text !== "string" || text.length === 0) return false;
	const lower = text.toLowerCase();
	return REFERENCE_PHRASES.some((phrase) => lower.includes(phrase));
}

// Exported for tests + potential downstream tuning.
export const HINT_REFERENCE_PHRASES = REFERENCE_PHRASES;
