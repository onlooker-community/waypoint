import type { WaypointCase } from "../models/case.js";
import type { WaypointHint } from "../models/hint.js";
import type { HintOutcome } from "../models/outcome.js";
import type { AgentCapabilityProfile } from "../models/profile.js";
import type { RelianceScore } from "../models/reliance.js";
import type { PlaybookBullet } from "../playbook/bullet.js";

export type BulletFeedbackKind = "helpful" | "harmful" | "neutral";

export interface WaypointStore {
  // Cases — audit trail for curation (saved when hint() runs)
  saveCase(c: WaypointCase): Promise<void>;
  getCase(caseId: string): Promise<WaypointCase | null>;

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

  // Playbook
  listBullets(): Promise<PlaybookBullet[]>;
  appendBullet(bullet: PlaybookBullet): Promise<void>;
  deleteBullet(bulletId: string): Promise<void>;
  markBulletsSeen(bulletIds: string[]): Promise<void>;
  applyBulletFeedback(
    bulletIds: string[],
    feedback: BulletFeedbackKind
  ): Promise<void>;
}