import type {
  WaypointAdapter,
  AdapterContext,
  ReasonerInfo,
} from "@waypoint/core";
import type { WaypointCase } from "@waypoint/core";
import type { WaypointHint } from "@waypoint/core";
import type { HintOutcome } from "@waypoint/core";

export class ClaudeAdapter implements WaypointAdapter {
  readonly id = "claude";
  readonly version = "0.1.0";

  parseFailure(_rawEvent: unknown): WaypointCase {
    throw new Error("ClaudeAdapter.parseFailure not yet implemented");
  }

  async deliverHint(
    _hint: WaypointHint,
    _context: AdapterContext
  ): Promise<void> {
    throw new Error("ClaudeAdapter.deliverHint not yet implemented");
  }

  parseOutcome(_rawEvent: unknown): HintOutcome {
    throw new Error("ClaudeAdapter.parseOutcome not yet implemented");
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