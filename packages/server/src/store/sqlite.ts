import Database, { type Database as DatabaseT } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
	WaypointCaseSchema,
	WaypointHintSchema,
	HintOutcomeSchema,
	RelianceScoreSchema,
	AgentCapabilityProfileSchema,
	PlaybookBulletSchema,
	type WaypointStore,
	type BulletFeedbackKind,
	type WaypointCase,
	type WaypointHint,
	type HintOutcome,
	type RelianceScore,
	type AgentCapabilityProfile,
	type PlaybookBullet,
} from "@waypoint/core";

export interface SqliteStoreOptions {
	/** Absolute path to the database file. Defaults to ~/.waypoint/playbook.db. */
	dbPath?: string;
}

/**
 * SQLite-backed implementation of {@link WaypointStore}.
 *
 * Storage strategy:
 *   - Each entity gets its own table.
 *   - Primary keys and the handful of columns we filter / join on are stored
 *     as proper SQL columns; everything else is round-tripped through JSON.
 *   - Migrations are idempotent `CREATE TABLE IF NOT EXISTS` statements run
 *     once at construction time.
 *   - WAL is enabled so readers don't block writers — relevant if the server
 *     and a CLI share the same database file.
 */
export class SqliteStore implements WaypointStore {
	private readonly db: DatabaseT;

	constructor(options: SqliteStoreOptions = {}) {
		const dbPath =
			options.dbPath ?? join(homedir(), ".waypoint", "playbook.db");

		// Ensure parent directory exists before opening (better-sqlite3 won't mkdir for us).
		mkdirSync(dirname(dbPath), { recursive: true });

		this.db = new Database(dbPath);
		this.db.pragma("journal_mode = WAL");
		this.db.pragma("foreign_keys = ON");

		this.migrate();
	}

	private migrate(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS cases (
				id        TEXT PRIMARY KEY,
				agent_id  TEXT,
				data      TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_cases_agent_id ON cases(agent_id);

			CREATE TABLE IF NOT EXISTS hints (
				id      TEXT PRIMARY KEY,
				case_id TEXT NOT NULL,
				data    TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_hints_case_id ON hints(case_id);

			CREATE TABLE IF NOT EXISTS outcomes (
				hint_id     TEXT NOT NULL,
				case_id     TEXT NOT NULL,
				recorded_at TEXT NOT NULL,
				data        TEXT NOT NULL,
				PRIMARY KEY (hint_id, recorded_at)
			);
			CREATE INDEX IF NOT EXISTS idx_outcomes_case_id ON outcomes(case_id);

			CREATE TABLE IF NOT EXISTS reliance_scores (
				case_id TEXT PRIMARY KEY,
				data    TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS profiles (
				agent_id TEXT PRIMARY KEY,
				data     TEXT NOT NULL
			);

			CREATE TABLE IF NOT EXISTS playbook_bullets (
				id            TEXT PRIMARY KEY,
				category      TEXT NOT NULL,
				task_types    TEXT NOT NULL,
				last_seen_at  TEXT NOT NULL,
				data          TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_bullets_category ON playbook_bullets(category);
		`);
	}

	close(): void {
		this.db.close();
	}

	// ---- cases ----

	async saveCase(c: WaypointCase): Promise<void> {
		const parsed = WaypointCaseSchema.parse(c);
		this.db
			.prepare(
				"INSERT OR REPLACE INTO cases (id, agent_id, data) VALUES (?, ?, ?)"
			)
			.run(parsed.id, parsed.agentId ?? null, serialize(parsed));
	}

	async getCase(caseId: string): Promise<WaypointCase | null> {
		const row = this.db
			.prepare("SELECT data FROM cases WHERE id = ?")
			.get(caseId) as { data: string } | undefined;
		if (!row) return null;
		return WaypointCaseSchema.parse(deserialize(row.data));
	}

	// ---- hints ----

	async saveHint(hint: WaypointHint): Promise<void> {
		const parsed = WaypointHintSchema.parse(hint);
		this.db
			.prepare(
				"INSERT OR REPLACE INTO hints (id, case_id, data) VALUES (?, ?, ?)"
			)
			.run(parsed.id, parsed.caseId, serialize(parsed));
	}

	async getHint(hintId: string): Promise<WaypointHint | null> {
		const row = this.db
			.prepare("SELECT data FROM hints WHERE id = ?")
			.get(hintId) as { data: string } | undefined;
		if (!row) return null;
		return WaypointHintSchema.parse(deserialize(row.data));
	}

	// ---- outcomes ----

	async saveOutcome(outcome: HintOutcome): Promise<void> {
		const parsed = HintOutcomeSchema.parse(outcome);
		this.db
			.prepare(
				`INSERT INTO outcomes (hint_id, case_id, recorded_at, data)
				 VALUES (?, ?, ?, ?)`
			)
			.run(
				parsed.hintId,
				parsed.caseId,
				parsed.recordedAt.toISOString(),
				serialize(parsed)
			);
	}

	async getOutcomesForAgent(agentId: string): Promise<HintOutcome[]> {
		// Outcome rows don't store agentId directly; the in-memory reference
		// implementation filters by `caseId.startsWith(agentId)`. Mirror that
		// so behaviour is consistent across stores.
		const rows = this.db
			.prepare(
				"SELECT data FROM outcomes WHERE case_id LIKE ? ORDER BY recorded_at ASC"
			)
			.all(`${agentId}%`) as Array<{ data: string }>;
		return rows.map((r) => HintOutcomeSchema.parse(deserialize(r.data)));
	}

	// ---- reliance scores ----

	async saveRelianceScore(
		caseId: string,
		score: RelianceScore
	): Promise<void> {
		const parsed = RelianceScoreSchema.parse(score);
		this.db
			.prepare(
				"INSERT OR REPLACE INTO reliance_scores (case_id, data) VALUES (?, ?)"
			)
			.run(caseId, serialize(parsed));
	}

	async getRelianceScore(caseId: string): Promise<RelianceScore | null> {
		const row = this.db
			.prepare("SELECT data FROM reliance_scores WHERE case_id = ?")
			.get(caseId) as { data: string } | undefined;
		if (!row) return null;
		return RelianceScoreSchema.parse(deserialize(row.data));
	}

	// ---- profiles ----

	async saveProfile(profile: AgentCapabilityProfile): Promise<void> {
		const parsed = AgentCapabilityProfileSchema.parse(profile);
		this.db
			.prepare(
				"INSERT OR REPLACE INTO profiles (agent_id, data) VALUES (?, ?)"
			)
			.run(parsed.agentId, serialize(parsed));
	}

	async getProfile(agentId: string): Promise<AgentCapabilityProfile | null> {
		const row = this.db
			.prepare("SELECT data FROM profiles WHERE agent_id = ?")
			.get(agentId) as { data: string } | undefined;
		if (!row) return null;
		return AgentCapabilityProfileSchema.parse(deserialize(row.data));
	}

	// ---- playbook bullets ----

	async listBullets(): Promise<PlaybookBullet[]> {
		const rows = this.db
			.prepare("SELECT data FROM playbook_bullets")
			.all() as Array<{ data: string }>;
		return rows.map((r) => PlaybookBulletSchema.parse(deserialize(r.data)));
	}

	async appendBullet(bullet: PlaybookBullet): Promise<void> {
		const parsed = PlaybookBulletSchema.parse(bullet);
		this.db
			.prepare(
				`INSERT OR REPLACE INTO playbook_bullets
				   (id, category, task_types, last_seen_at, data)
				 VALUES (?, ?, ?, ?, ?)`
			)
			.run(
				parsed.id,
				parsed.category,
				JSON.stringify(parsed.taskTypes),
				parsed.lastSeenAt.toISOString(),
				serialize(parsed)
			);
	}

	async deleteBullet(bulletId: string): Promise<void> {
		this.db
			.prepare("DELETE FROM playbook_bullets WHERE id = ?")
			.run(bulletId);
	}

	async markBulletsSeen(bulletIds: string[]): Promise<void> {
		if (bulletIds.length === 0) return;
		const now = new Date();
		const select = this.db.prepare(
			"SELECT data FROM playbook_bullets WHERE id = ?"
		);
		const update = this.db.prepare(
			"UPDATE playbook_bullets SET data = ?, last_seen_at = ? WHERE id = ?"
		);
		const tx = this.db.transaction((ids: string[]) => {
			for (const id of ids) {
				const row = select.get(id) as { data: string } | undefined;
				if (!row) continue;
				const bullet = PlaybookBulletSchema.parse(deserialize(row.data));
				const next: PlaybookBullet = { ...bullet, lastSeenAt: now };
				update.run(serialize(next), now.toISOString(), id);
			}
		});
		tx(bulletIds);
	}

	async applyBulletFeedback(
		bulletIds: string[],
		feedback: BulletFeedbackKind
	): Promise<void> {
		if (bulletIds.length === 0) return;
		const now = new Date();
		const select = this.db.prepare(
			"SELECT data FROM playbook_bullets WHERE id = ?"
		);
		const update = this.db.prepare(
			"UPDATE playbook_bullets SET data = ?, last_seen_at = ? WHERE id = ?"
		);
		const tx = this.db.transaction((ids: string[]) => {
			for (const id of ids) {
				const row = select.get(id) as { data: string } | undefined;
				if (!row) continue;
				const bullet = PlaybookBulletSchema.parse(deserialize(row.data));
				const next: PlaybookBullet = { ...bullet, lastSeenAt: now };
				if (feedback === "helpful") next.helpfulCount += 1;
				else if (feedback === "harmful") next.harmfulCount += 1;
				else next.neutralCount += 1;
				update.run(serialize(next), now.toISOString(), id);
			}
		});
		tx(bulletIds);
	}
}

// ----- serialisation helpers --------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function dateReviver(_key: string, value: unknown): unknown {
	if (typeof value === "string" && ISO_DATE_RE.test(value)) {
		return new Date(value);
	}
	return value;
}

function serialize(value: unknown): string {
	return JSON.stringify(value);
}

function deserialize(raw: string): unknown {
	return JSON.parse(raw, dateReviver);
}
