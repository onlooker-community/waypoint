import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  WaypointStore,
  WaypointHint,
  HintOutcome,
  AgentCapabilityProfile,
  RelianceScore,
} from "@waypoint/core";

interface StoreData {
  hints: Record<string, WaypointHint>;
  outcomes: Record<string, HintOutcome[]>;
  relianceScores: Record<string, RelianceScore>;
  profiles: Record<string, AgentCapabilityProfile>;
}

// ISO-8601 date strings from JSON.parse are coerced back to Date objects.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    return new Date(value);
  }
  return value;
}

function emptyData(): StoreData {
  return { hints: {}, outcomes: {}, relianceScores: {}, profiles: {} };
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
      this.cache = JSON.parse(raw, dateReviver) as StoreData;
    } catch {
      this.cache = emptyData();
    }

    return this.cache;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.dataPath), { recursive: true });
    await writeFile(this.dataPath, JSON.stringify(this.cache, null, 2), "utf-8");
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
}
