import type {
  WaypointAdapter,
  AdapterContext,
  ReasonerInfo,
} from "@waypoint/core";
import type { WaypointCase } from "@waypoint/core";
import type { WaypointHint } from "@waypoint/core";
import type { HintOutcome } from "@waypoint/core";

export class GeminiAdapter implements WaypointAdapter {
  readonly id = "gemini";
  readonly version = "0.1.0";

  parseFailure(_rawEvent: unknown): WaypointCase {
    throw new Error("GeminiAdapter.parseFailure not yet implemented");
  }

  async deliverHint(
    _hint: WaypointHint,
    _context: AdapterContext
  ): Promise<void> {
    throw new Error("GeminiAdapter.deliverHint not yet implemented");
  }

  parseOutcome(_rawEvent: unknown): HintOutcome {
    throw new Error("GeminiAdapter.parseOutcome not yet implemented");
  }

  getReasonerInfo(): ReasonerInfo {
    return {
      modelId: "gemini-2.0-flash",
      provider: "google",
      contextWindow: 1000000,
      supportsLogProbs: false,
    };
  }
}