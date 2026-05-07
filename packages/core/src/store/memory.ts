import type { WaypointStore } from "./types.js";
import type { WaypointHint } from "../models/hint.js";
import type { HintOutcome } from "../models/outcome.js";
import type { AgentCapabilityProfile } from "../models/profile.js";
import type { RelianceScore } from "../models/reliance.js";

export class MemoryStore implements WaypointStore {
  private hints = new Map<string, WaypointHint>();
  private outcomes = new Map<string, HintOutcome[]>();
  private relianceScores = new Map<string, RelianceScore>();
  private profiles = new Map<string, AgentCapabilityProfile>();

  async saveHint(hint: WaypointHint): Promise<void> {
    this.hints.set(hint.id, hint);
  }

  async getHint(hintId: string): Promise<WaypointHint | null> {
    return this.hints.get(hintId) ?? null;
  }

  async saveOutcome(outcome: HintOutcome): Promise<void> {
    const existing = this.outcomes.get(outcome.hintId) ?? [];
    this.outcomes.set(outcome.hintId, [...existing, outcome]);
  }

  async getOutcomesForAgent(agentId: string): Promise<HintOutcome[]> {
    // Collect all outcomes where the associated hint's caseId matches agentId
    // In memory we do a linear scan — real stores would index this
    const all: HintOutcome[] = [];
    for (const outcomes of this.outcomes.values()) {
      all.push(...outcomes);
    }
    return all.filter((o) => o.caseId.startsWith(agentId));
  }

  async saveRelianceScore(
    caseId: string,
    score: RelianceScore
  ): Promise<void> {
    this.relianceScores.set(caseId, score);
  }

  async getRelianceScore(caseId: string): Promise<RelianceScore | null> {
    return this.relianceScores.get(caseId) ?? null;
  }

  async saveProfile(profile: AgentCapabilityProfile): Promise<void> {
    this.profiles.set(profile.agentId, profile);
  }

  async getProfile(
    agentId: string
  ): Promise<AgentCapabilityProfile | null> {
    return this.profiles.get(agentId) ?? null;
  }
}