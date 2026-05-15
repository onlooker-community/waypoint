import type { WaypointAPI } from "./types.js";
import type { WaypointCase } from "../models/case.js";
import type { WaypointHint } from "../models/hint.js";
import type { HintOutcome } from "../models/outcome.js";
import type { DifficultyEstimate } from "../models/difficulty.js";
import type { AgentCapabilityProfile } from "../models/profile.js";
import type { RelianceScore } from "../models/reliance.js";
import type { Task } from "../models/task.js";
import type { WaypointStore } from "../store/types.js";
export {
  type WaypointDeps,
  type WaypointRuntime,
  type HintGenerationInput,
  type GeneratedHintPayload,
} from "./waypoint.js";
// Note: `createWaypoint` is intentionally NOT re-exported from ./waypoint.js
// here — that module exports a deps-injected factory with a different
// signature. The convenience factory below (with `WaypointOptions`) is the
// public surface most callers consume; the deps-injected form lives in
// ./waypoint.js for internal/advanced use.
import { MemoryStore } from "../store/memory.js";
import { runHinter } from "../hinter/index.js";
import { measureReliance as measureRelianceImpl } from "../reliance/index.js";
import { estimateDifficulty as estimateDifficultyImpl } from "../router/index.js";
import { updateProfile, createEmptyProfile } from "./profile.js";

export interface WaypointOptions {
  store?: WaypointStore;
  model?: string;
}

export class Waypoint implements WaypointAPI {
  private store: WaypointStore;
  private model: string;

  constructor(options: WaypointOptions = {}) {
    this.store = options.store ?? new MemoryStore();
    this.model = options.model ?? "claude-sonnet-4-20250514";
  }

  async hint(waypointCase: WaypointCase): Promise<WaypointHint> {
    const hint = await runHinter(waypointCase, { model: this.model });
    await this.store.saveHint(hint);
    return hint;
  }

  async measureReliance(
    task: string,
    hint: string,
    output: string,
    method: "logprob" | "judge" = "judge"
  ): Promise<RelianceScore> {
    return measureRelianceImpl(task, hint, output, { method });
  }

  async recordOutcome(outcome: HintOutcome): Promise<void> {
    await this.store.saveOutcome(outcome);

    // Update agent profile if we have an agentId
    // We get it from the hint's associated case
    const hint = await this.store.getHint(outcome.hintId);
    if (!hint) return;

    // Measure reliance post-hoc if we have the final output
    if (outcome.finalOutput) {
      const reliance = await this.measureReliance(
        outcome.caseId,
        hint.content,
        outcome.finalOutput
      );
      await this.store.saveRelianceScore(outcome.caseId, reliance);
    }
  }

  async estimateDifficulty(
    task: Task,
    agentProfile?: AgentCapabilityProfile
  ): Promise<DifficultyEstimate> {
    return estimateDifficultyImpl(task, 0, agentProfile, {
      model: this.model,
    });
  }

  async getAgentProfile(agentId: string): Promise<AgentCapabilityProfile> {
    const profile = await this.store.getProfile(agentId);
    return profile ?? createEmptyProfile(agentId);
  }
}

// Convenience factory — most callers just want a default instance
export function createWaypoint(options: WaypointOptions = {}): WaypointAPI {
  return new Waypoint(options);
}
