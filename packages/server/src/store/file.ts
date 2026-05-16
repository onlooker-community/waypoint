import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  WaypointStore,
  BulletFeedbackKind,
  WaypointCase,
  WaypointHint,
  HintOutcome,
  AgentCapabilityProfile,
  RelianceScore,
  PlaybookBullet,
} from "@waypoint/core";

interface StoreData {
  cases: Record<string, WaypointCase>;
  hints: Record<string, WaypointHint>;
  outcomes: Record<string, HintOutcome[]>;
  relianceScores: Record<string, RelianceScore>;
  profiles: Record<string, AgentCapabilityProfile>;
  bullets: Record<string, PlaybookBullet>;
}

// Restore Date objects only on fields whose schemas use `z.date()`. A blanket
// match-any-ISO-prefix reviver would also convert arbitrary content fields
// (task content, hint content, bullet text) whenever they happen to start with
// a timestamp, leaving them as Dates and breaking Zod parsing on read.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const DATE_FIELDS: ReadonlySet<string> = new Set([
  "createdAt",
  "lastSeenAt",
  "lastUpdated",
  "recordedAt",
  "timestamp",
]);

function dateReviver(key: string, value: unknown): unknown {
  if (
    DATE_FIELDS.has(key) &&
    typeof value === "string" &&
    ISO_DATE_RE.test(value)
  ) {
    return new Date(value);
  }
  return value;
}

function emptyData(): StoreData {
  return {
    cases: {},
    hints: {},
    outcomes: {},
    relianceScores: {},
    profiles: {},
    bullets: {},
  };
}

/**
 * Simple file-backed store.  Serialises to a single JSON file on disk.
 * Suitable for single-instance deploys — no locking, no migrations.
 */
export class FileStore implements WaypointStore {
  private readonly dataPath: string;
  private cache: StoreData | null = null;

  constructor(dataPath = ".waypoint/store.json") {
    this.dataPath = dataPath;
  }

  private async load(): Promise<StoreData> {
    if (this.cache) return this.cache;

    try {
      const raw = await readFile(this.dataPath, "utf-8");
      const parsed = JSON.parse(raw, dateReviver) as Partial<StoreData>;
      this.cache = { ...emptyData(), ...parsed };
    } catch {
      this.cache = emptyData();
    }

    return this.cache;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.dataPath), { recursive: true });
    await writeFile(this.dataPath, JSON.stringify(this.cache, null, 2), "utf-8");
  }

  async saveCase(c: WaypointCase): Promise<void> {
    const data = await this.load();
    data.cases[c.id] = c;
    await this.persist();
  }

  async getCase(caseId: string): Promise<WaypointCase | null> {
    const data = await this.load();
    return data.cases[caseId] ?? null;
  }

  async saveHint(hint: WaypointHint): Promise<void> {
    const data = await this.load();
    data.hints[hint.id] = hint;
    await this.persist();
  }

  async getHint(hintId: string): Promise<WaypointHint | null> {
    const data = await this.load();
    return data.hints[hintId] ?? null;
  }

  async saveOutcome(outcome: HintOutcome): Promise<void> {
    const data = await this.load();
    const existing = data.outcomes[outcome.hintId] ?? [];
    data.outcomes[outcome.hintId] = [...existing, outcome];
    await this.persist();
  }

  async getOutcomesForAgent(agentId: string): Promise<HintOutcome[]> {
    const data = await this.load();
    return Object.values(data.outcomes)
      .flat()
      .filter((o) => o.caseId.startsWith(agentId));
  }

  async saveRelianceScore(caseId: string, score: RelianceScore): Promise<void> {
    const data = await this.load();
    data.relianceScores[caseId] = score;
    await this.persist();
  }

  async getRelianceScore(caseId: string): Promise<RelianceScore | null> {
    const data = await this.load();
    return data.relianceScores[caseId] ?? null;
  }

  async saveProfile(profile: AgentCapabilityProfile): Promise<void> {
    const data = await this.load();
    data.profiles[profile.agentId] = profile;
    await this.persist();
  }

  async getProfile(agentId: string): Promise<AgentCapabilityProfile | null> {
    const data = await this.load();
    return data.profiles[agentId] ?? null;
  }

  async listBullets(): Promise<PlaybookBullet[]> {
    const data = await this.load();
    return Object.values(data.bullets);
  }

  async appendBullet(bullet: PlaybookBullet): Promise<void> {
    const data = await this.load();
    data.bullets[bullet.id] = bullet;
    await this.persist();
  }

  async deleteBullet(bulletId: string): Promise<void> {
    const data = await this.load();
    delete data.bullets[bulletId];
    await this.persist();
  }

  async markBulletsSeen(bulletIds: string[]): Promise<void> {
    const data = await this.load();
    const now = new Date();
    for (const id of bulletIds) {
      const b = data.bullets[id];
      if (b) data.bullets[id] = { ...b, lastSeenAt: now };
    }
    await this.persist();
  }

  async applyBulletFeedback(
    bulletIds: string[],
    feedback: BulletFeedbackKind
  ): Promise<void> {
    const data = await this.load();
    const now = new Date();
    for (const id of bulletIds) {
      const b = data.bullets[id];
      if (!b) continue;
      const next = { ...b, lastSeenAt: now };
      if (feedback === "helpful") next.helpfulCount += 1;
      else if (feedback === "harmful") next.harmfulCount += 1;
      else next.neutralCount += 1;
      data.bullets[id] = next;
    }
    await this.persist();
  }
}
