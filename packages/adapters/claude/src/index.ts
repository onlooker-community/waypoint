import type {
	WaypointAdapter,
	AdapterContext,
	ReasonerInfo,
	WaypointCase,
	WaypointHint,
	HintOutcome,
} from "@waypoint/core";
import { HintOutcomeSchema } from "@waypoint/core";
import { parseClaudeFailure } from "./parser.js";
import { appendHintToNextUserMessage } from "./delivery.js";
import type { ClaudeMessageContext, ClaudeOutcomeEvent } from "./types.js";

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

		const updated = appendHintToNextUserMessage(hint, raw);

		// Mutate the original context payload so host integrations can forward it directly.
		context.raw = updated;
	}

	parseOutcome(rawEvent: unknown): HintOutcome {
		const event = rawEvent as ClaudeOutcomeEvent;

		return HintOutcomeSchema.parse({
			hintId: event.hintId,
			caseId: event.caseId,
			succeeded: event.succeeded,
			hintReferenced: event.hintReferenced,
			attemptsAfterHint: event.attemptsAfterHint,
			finalOutput: event.finalOutput,
			timeToSuccessMs: event.timeToSuccessMs,
			recordedAt: new Date(),
		});
	}

	getReasonerInfo(): ReasonerInfo {
		return {
			modelId: "claude-sonnet-4-20250514",
			provider: "anthropic",
			contextWindow: 200000,
			supportsLogProbs: false,
		};
	}
}

export { parseClaudeFailure } from "./parser.js";
export { appendHintToNextUserMessage } from "./delivery.js";
export type {
	ClaudeFailureEvent,
	ClaudeOutcomeEvent,
	ClaudeMessageContext,
} from "./types.js";
