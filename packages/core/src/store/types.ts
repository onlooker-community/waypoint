import type { WaypointHint } from "../models/hint.js";
import type { HintOutcome } from "../models/outcome.js";
import type { AgentCapabilityProfile } from "../models/profile.js";
import type { RelianceScore } from "../models/reliance.js";

export interface WaypointStore {
  // Hints
  saveHint(hint: WaypointHint): Promise<void>;
  getHint(hintId: string): Promise<WaypointHint | null>;

  // Outcomes
  saveOutcome(outcome: HintOutcome): Promise<void>;
  getOutcomesForAgent(agentId: string): Promise<HintOutcome[]>;

  // Reliance scores
  saveRelianceScore(caseId: string, score: RelianceScore): Promise<void>;
  getRelianceScore(caseId: string): Promise<RelianceScore | null>;

  // Agent profiles
  saveProfile(profile: AgentCapabilityProfile): Promise<void>;
  getProfile(agentId: string): Promise<AgentCapabilityProfile | null>;
}