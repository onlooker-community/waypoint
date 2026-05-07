import type {
  WaypointAdapter,
  AdapterContext,
  ReasonerInfo,
} from "@waypoint/core";
import type { WaypointCase } from "@waypoint/core";
import type { WaypointHint } from "@waypoint/core";
import type { HintOutcome } from "@waypoint/core";

export class CopilotAdapter implements WaypointAdapter {
  readonly id = "copilot";
  readonly version = "0.1.0";

  parseFailure(_rawEvent: unknown): WaypointCase {
    throw new Error("CopilotAdapter.parseFailure not yet implemented");
  }

  async deliverHint(
    _hint: WaypointHint,
    _context: AdapterContext
  ): Promise<void> {
    throw new Error("CopilotAdapter.deliverHint not yet implemented");
  }

  parseOutcome(_rawEvent: unknown): HintOutcome {
    throw new Error("CopilotAdapter.parseOutcome not yet implemented");
  }

  getReasonerInfo(): ReasonerInfo {
    return {
      modelId: "gpt-4o",
      provider: "openai",
      contextWindow: 128000,
      supportsLogProbs: true,
    };
  }
}