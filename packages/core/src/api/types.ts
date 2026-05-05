import type { WaypointCase } from "../models/case.js";
import type { WaypointHint } from "../models/hint.js";
import type { HintOutcome } from "../models/outcome.js";
import type { DifficultyEstimate } from "../models/difficulty.js";
import type { AgentCapabilityProfile } from "../models/profile.js";
import type { RelianceScore } from "../models/reliance.js";
import type { Task } from "../models/task.js";

export interface WaypointAPI {
  // Core — takes a failure, returns a hint
  // This is the main entry point for adapters
  hint(waypointCase: WaypointCase): Promise<WaypointHint>;

  // Measure how much a successful output depended on a given hint
  // Call this after outcome is known to close the feedback loop
  measureReliance(
    task: string,
    hint: string,
    output: string,
    method?: "logprob" | "judge"
  ): Promise<RelianceScore>;

  // Report what happened after a hint was delivered
  // This is how Waypoint learns — don't skip it
  recordOutcome(outcome: HintOutcome): Promise<void>;

  // Estimate difficulty before deciding whether to hint
  // Use this to avoid hinting on easy tasks or wasting
  // calls on genuinely out-of-scope tasks
  estimateDifficulty(
    task: Task,
    agentProfile?: AgentCapabilityProfile
  ): Promise<DifficultyEstimate>;

  // Retrieve rolling capability stats for an agent
  // Powers adaptive difficulty routing over time
  getAgentProfile(agentId: string): Promise<AgentCapabilityProfile>;
}