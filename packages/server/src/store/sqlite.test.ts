import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
	createCase,
	createPlaybookBullet,
	type WaypointHint,
	type HintOutcome,
	type RelianceScore,
	type AgentCapabilityProfile,
} from "@waypoint/core";
import { SqliteStore } from "./sqlite.js";

let tmpDir: string;
let dbPath: string;
let store: SqliteStore;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), "waypoint-sqlite-"));
	dbPath = join(tmpDir, "playbook.db");
	store = new SqliteStore({ dbPath });
});

afterEach(() => {
	store.close();
	rmSync(tmpDir, { recursive: true, force: true });
});

function makeCase(agentId = "agent-1") {
	return createCase({
		task: {
			content: "compute 2+2",
			type: "code",
		},
		attempt: {
			content: "return 5",
			failureSignal: "wrong answer",
			attemptNumber: 1,
			timestamp: new Date("2024-01-01T00:00:00Z"),
		},
		agentId,
		sessionId: "session-1",
	});
}

function makeHint(caseId: string, id = "hint-1"): WaypointHint {
	return {
		id,
		content: "Consider edge cases.",
		caseId,
		deliveryMode: "append",
		quality: { signalCreation: 0.8, signalTransfer: 0.7, confidence: 0.6 },
		targetConcept: "edge-cases",
		playbookBulletIds: [],
		recommendation: "hint",
		createdAt: new Date("2024-01-01T00:00:00Z"),
	};
}

describe("SqliteStore — initialisation", () => {
	it("creates the db file (and parent dir) on construction", () => {
		expect(existsSync(dbPath)).toBe(true);
	});

	it("enables WAL journal mode", () => {
		const probe = new Database(dbPath, { readonly: true });
		try {
			const result = probe.pragma("journal_mode", { simple: true });
			expect(result).toBe("wal");
		} finally {
			probe.close();
		}
	});

	it("migrations are idempotent — reopening the same db does not error", () => {
		store.close();
		// Reopen — `CREATE TABLE IF NOT EXISTS` must not throw when tables already exist.
		store = new SqliteStore({ dbPath });
		expect(existsSync(dbPath)).toBe(true);
	});

	it("creates parent directory if missing", () => {
		store.close();
		const nested = join(tmpDir, "deep", "nested", "playbook.db");
		const s = new SqliteStore({ dbPath: nested });
		expect(existsSync(nested)).toBe(true);
		s.close();
		store = new SqliteStore({ dbPath });
	});
});

describe("SqliteStore — cases", () => {
	it("round-trips a case", async () => {
		const c = makeCase();
		await store.saveCase(c);
		const got = await store.getCase(c.id);
		expect(got).toEqual(c);
	});

	it("returns null for unknown id", async () => {
		expect(await store.getCase("nope")).toBeNull();
	});

	it("upserts (saveCase twice with same id replaces)", async () => {
		const c = makeCase();
		await store.saveCase(c);
		await store.saveCase({ ...c, sessionId: "session-2" });
		const got = await store.getCase(c.id);
		expect(got?.sessionId).toBe("session-2");
	});
});

describe("SqliteStore — hints", () => {
	it("round-trips a hint with Date fields", async () => {
		const c = makeCase();
		await store.saveCase(c);
		const hint = makeHint(c.id);
		await store.saveHint(hint);
		const got = await store.getHint(hint.id);
		expect(got).not.toBeNull();
		expect(got!.id).toBe(hint.id);
		expect(got!.createdAt).toBeInstanceOf(Date);
		expect(got!.createdAt.toISOString()).toBe(hint.createdAt.toISOString());
		expect(got!.quality).toEqual(hint.quality);
	});

	it("returns null for unknown hint", async () => {
		expect(await store.getHint("missing")).toBeNull();
	});
});

describe("SqliteStore — outcomes", () => {
	it("saves and retrieves outcomes for an agent", async () => {
		const c1 = makeCase("agent-A");
		const c2 = makeCase("agent-A");
		const c3 = makeCase("agent-B");
		await store.saveCase(c1);
		await store.saveCase(c2);
		await store.saveCase(c3);

		const o1: HintOutcome = {
			hintId: "h1",
			caseId: c1.id,
			succeeded: true,
			hintReferenced: false,
			attemptsAfterHint: 1,
			recordedAt: new Date("2024-01-01T00:00:00Z"),
		};
		const o2: HintOutcome = {
			hintId: "h2",
			caseId: c2.id,
			succeeded: false,
			hintReferenced: true,
			attemptsAfterHint: 3,
			recordedAt: new Date("2024-01-02T00:00:00Z"),
		};
		const o3: HintOutcome = {
			hintId: "h3",
			caseId: c3.id,
			succeeded: true,
			hintReferenced: false,
			attemptsAfterHint: 0,
			recordedAt: new Date("2024-01-03T00:00:00Z"),
		};

		// Match the in-memory store's filter: caseId.startsWith(agentId).
		// To do that we use caseIds that begin with the agentId.
		const oA1: HintOutcome = { ...o1, caseId: "agent-A:case-1" };
		const oA2: HintOutcome = { ...o2, caseId: "agent-A:case-2" };
		const oB: HintOutcome = { ...o3, caseId: "agent-B:case-1" };

		await store.saveOutcome(oA1);
		await store.saveOutcome(oA2);
		await store.saveOutcome(oB);

		const aOutcomes = await store.getOutcomesForAgent("agent-A");
		expect(aOutcomes).toHaveLength(2);
		expect(aOutcomes.map((o) => o.hintId).sort()).toEqual(["h1", "h2"]);

		const bOutcomes = await store.getOutcomesForAgent("agent-B");
		expect(bOutcomes).toHaveLength(1);
		expect(bOutcomes[0]?.hintId).toBe("h3");
	});

	it("preserves multiple outcomes for the same hint", async () => {
		const o1: HintOutcome = {
			hintId: "h-multi",
			caseId: "agent-X:case-1",
			succeeded: false,
			hintReferenced: false,
			attemptsAfterHint: 2,
			recordedAt: new Date("2024-01-01T00:00:00Z"),
		};
		const o2: HintOutcome = { ...o1, recordedAt: new Date("2024-01-02T00:00:00Z"), succeeded: true };
		await store.saveOutcome(o1);
		await store.saveOutcome(o2);
		const got = await store.getOutcomesForAgent("agent-X");
		expect(got).toHaveLength(2);
	});
});

describe("SqliteStore — reliance scores", () => {
	it("round-trips a reliance score", async () => {
		const score: RelianceScore = {
			score: 0.42,
			assessment: "medium",
			method: "judge",
			reasoning: "moderate dependence on hint phrasing",
			hintExplicitlyReferenced: false,
		};
		await store.saveRelianceScore("case-1", score);
		const got = await store.getRelianceScore("case-1");
		expect(got).toEqual(score);
	});

	it("returns null for missing case", async () => {
		expect(await store.getRelianceScore("missing")).toBeNull();
	});

	it("upserts on duplicate caseId", async () => {
		const s1: RelianceScore = {
			score: 0.1,
			assessment: "low",
			method: "logprob",
			reasoning: "first",
			hintExplicitlyReferenced: false,
		};
		const s2: RelianceScore = { ...s1, score: 0.9, assessment: "high", reasoning: "second" };
		await store.saveRelianceScore("case-1", s1);
		await store.saveRelianceScore("case-1", s2);
		const got = await store.getRelianceScore("case-1");
		expect(got?.reasoning).toBe("second");
		expect(got?.score).toBe(0.9);
	});
});

describe("SqliteStore — profiles", () => {
	it("round-trips a profile", async () => {
		const profile: AgentCapabilityProfile = {
			agentId: "agent-1",
			strengths: ["code"],
			weaknesses: ["reasoning"],
			overall: {
				totalCases: 10,
				successRate: 0.7,
				averageAttemptsToSuccess: 1.5,
				averageReliance: 0.3,
				hintSuccessRate: 0.8,
			},
			byTaskType: {
				code: {
					totalCases: 6,
					successRate: 0.9,
					averageAttemptsToSuccess: 1.2,
					averageReliance: 0.2,
					hintSuccessRate: 0.9,
				},
			},
			lastUpdated: new Date("2024-02-01T00:00:00Z"),
			sessionCount: 3,
		};
		await store.saveProfile(profile);
		const got = await store.getProfile("agent-1");
		expect(got).not.toBeNull();
		expect(got!.strengths).toEqual(["code"]);
		expect(got!.lastUpdated).toBeInstanceOf(Date);
		expect(got!.byTaskType.code?.successRate).toBe(0.9);
	});
});

describe("SqliteStore — playbook bullets", () => {
	it("appends and lists bullets", async () => {
		const b = createPlaybookBullet({
			id: "b1",
			content: "Look up the docs before guessing.",
			category: "task_strategy",
			taskTypes: ["code"],
			targetConcept: "doc-lookup",
			helpfulCount: 0,
			harmfulCount: 0,
			neutralCount: 0,
			sourceHintId: "h1",
			sourceCaseId: "c1",
		});
		await store.appendBullet(b);
		const list = await store.listBullets();
		expect(list).toHaveLength(1);
		expect(list[0]?.id).toBe("b1");
		expect(list[0]?.createdAt).toBeInstanceOf(Date);
	});

	it("deletes a bullet", async () => {
		const b = createPlaybookBullet({
			id: "b1",
			content: "x",
			category: "tool_usage",
			taskTypes: ["code"],
			targetConcept: "tool",
			helpfulCount: 0,
			harmfulCount: 0,
			neutralCount: 0,
			sourceHintId: "h1",
			sourceCaseId: "c1",
		});
		await store.appendBullet(b);
		await store.deleteBullet("b1");
		expect(await store.listBullets()).toHaveLength(0);
	});

	it("markBulletsSeen updates lastSeenAt", async () => {
		const original = new Date("2020-01-01T00:00:00Z");
		const b = createPlaybookBullet({
			id: "b1",
			content: "x",
			category: "tool_usage",
			taskTypes: ["code"],
			targetConcept: "tool",
			helpfulCount: 0,
			harmfulCount: 0,
			neutralCount: 0,
			sourceHintId: "h1",
			sourceCaseId: "c1",
			createdAt: original,
			lastSeenAt: original,
		});
		await store.appendBullet(b);
		await store.markBulletsSeen(["b1"]);
		const [got] = await store.listBullets();
		expect(got?.lastSeenAt.getTime()).toBeGreaterThan(original.getTime());
	});

	it("applyBulletFeedback increments the right counter", async () => {
		const b = createPlaybookBullet({
			id: "b1",
			content: "x",
			category: "tool_usage",
			taskTypes: ["code"],
			targetConcept: "tool",
			helpfulCount: 0,
			harmfulCount: 0,
			neutralCount: 0,
			sourceHintId: "h1",
			sourceCaseId: "c1",
		});
		await store.appendBullet(b);
		await store.applyBulletFeedback(["b1"], "helpful");
		await store.applyBulletFeedback(["b1"], "helpful");
		await store.applyBulletFeedback(["b1"], "harmful");
		await store.applyBulletFeedback(["b1"], "neutral");
		const [got] = await store.listBullets();
		expect(got?.helpfulCount).toBe(2);
		expect(got?.harmfulCount).toBe(1);
		expect(got?.neutralCount).toBe(1);
	});

	it("no-ops on empty arrays", async () => {
		await expect(store.markBulletsSeen([])).resolves.toBeUndefined();
		await expect(store.applyBulletFeedback([], "helpful")).resolves.toBeUndefined();
	});

	it("silently ignores unknown ids in markBulletsSeen / applyBulletFeedback", async () => {
		await store.markBulletsSeen(["does-not-exist"]);
		await store.applyBulletFeedback(["does-not-exist"], "helpful");
		expect(await store.listBullets()).toHaveLength(0);
	});
});

describe("SqliteStore — persistence", () => {
	it("data survives a store close + reopen", async () => {
		const c = makeCase();
		await store.saveCase(c);
		const b = createPlaybookBullet({
			id: "b1",
			content: "persisted bullet",
			category: "successful_hint",
			taskTypes: ["code"],
			targetConcept: "persistence",
			helpfulCount: 0,
			harmfulCount: 0,
			neutralCount: 0,
			sourceHintId: "h1",
			sourceCaseId: c.id,
		});
		await store.appendBullet(b);

		store.close();
		store = new SqliteStore({ dbPath });

		expect(await store.getCase(c.id)).toEqual(c);
		const bullets = await store.listBullets();
		expect(bullets.map((x) => x.id)).toEqual(["b1"]);
	});
});
