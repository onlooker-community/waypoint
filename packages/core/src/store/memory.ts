import type { WaypointStore, BulletFeedbackKind } from "./types.js";
import type { WaypointCase } from "../models/case.js";
import { WaypointHintSchema, type WaypointHint } from "../models/hint.js";
import type { HintOutcome } from "../models/outcome.js";
import type { AgentCapabilityProfile } from "../models/profile.js";
import type { RelianceScore } from "../models/reliance.js";
import type { PlaybookBullet } from "../playbook/bullet.js";

export class MemoryStore implements WaypointStore {
  private cases = new Map<string, WaypointCase>();
  private hints = new Map<string, WaypointHint>();
  private outcomes = new Map<string, HintOutcome[]>();
  private relianceScores = new Map<string, RelianceScore>();
  private profiles = new Map<string, AgentCapabilityProfile>();
  private bullets = new Map<string, PlaybookBullet>();

  async saveCase(c: WaypointCase): Promise<void> {
    this.cases.set(c.id, c);
  }

  async getCase(caseId: string): Promise<WaypointCase | null> {
    return this.cases.get(caseId) ?? null;
  }

  async saveHint(hint: WaypointHint): Promise<void> {
    this.hints.set(hint.id, WaypointHintSchema.parse(hint));
  }

  async getHint(hintId: string): Promise<WaypointHint | null> {
    const h = this.hints.get(hintId);
    return h ? WaypointHintSchema.parse(h) : null;
  }

  async saveOutcome(outcome: HintOutcome): Promise<void> {
    const existing = this.outcomes.get(outcome.hintId) ?? [];
    this.outcomes.set(outcome.hintId, [...existing, outcome]);
  }

  async getOutcomesForAgent(agentId: string): Promise<HintOutcome[]> {
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

  async listBullets(): Promise<PlaybookBullet[]> {
    return [...this.bullets.values()];
  }

  async appendBullet(bullet: PlaybookBullet): Promise<void> {
    this.bullets.set(bullet.id, bullet);
  }

  async deleteBullet(bulletId: string): Promise<void> {
    this.bullets.delete(bulletId);
  }

  async markBulletsSeen(bulletIds: string[]): Promise<void> {
    const now = new Date();
    for (const id of bulletIds) {
      const b = this.bullets.get(id);
      if (b) {
        this.bullets.set(id, { ...b, lastSeenAt: now });
      }
    }
  }

  async applyBulletFeedback(
    bulletIds: string[],
    feedback: BulletFeedbackKind
  ): Promise<void> {
    for (const id of bulletIds) {
      const b = this.bullets.get(id);
      if (!b) {
        continue;
      }
      const next = { ...b };
      if (feedback === "helpful") {
        next.helpfulCount += 1;
      } else if (feedback === "harmful") {
        next.harmfulCount += 1;
      } else {
        next.neutralCount += 1;
      }
      next.lastSeenAt = new Date();
      this.bullets.set(id, next);
    }
  }
}
