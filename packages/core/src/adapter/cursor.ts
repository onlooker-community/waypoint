import type {
  WaypointAdapter,
  AdapterContext,
  ReasonerInfo,
} from "@waypoint/core";
import type { WaypointCase } from "@waypoint/core";
import type { WaypointHint } from "@waypoint/core";
import type { HintOutcome } from "@waypoint/core";

export class CursorAdapter implements WaypointAdapter {
  readonly id = "cursor";
  readonly version = "0.1.0";

  parseFailure(_rawEvent: unknown): WaypointCase {
    throw new Error("CursorAdapter.parseFailure not yet implemented");
  }

  async deliverHint(
    _hint: WaypointHint,
    _context: AdapterContext
  ): Promise<void> {
    throw new Error("CursorAdapter.deliverHint not yet implemented");
  }

  parseOutcome(_rawEvent: unknown): HintOutcome {
    throw new Error("CursorAdapter.parseOutcome not yet implemented");
  }

  getReasonerInfo(): ReasonerInfo {
    return {
      // Cursor uses different models — this is a placeholder
      modelId: "unknown",
      provider: "anthropic",
      contextWindow: 200000,
      supportsLogProbs: false,
    };
  }
}