/**
 * Waypoint end-to-end demo — basic-hint.
 *
 * What this script demonstrates, in order:
 *   1. Build a `WaypointCase` describing a realistic coding failure.
 *   2. Call `waypoint.hint(case)` to generate a hint via the configured model.
 *   3. Simulate a successful retry by synthesising an attempt object
 *      (no second model round-trip needed for the demo).
 *   4. Call `waypoint.recordOutcome()` so Waypoint can score reliance,
 *      update feedback counters on injected bullets, and so on.
 *   5. Curate a Playbook lesson from this case + hint + outcome, and
 *      persist it via the store.
 *   6. List the Playbook and show the accumulated bullet — proving the
 *      lesson survives across runs (SqliteStore is on disk).
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/basic-hint/index.ts
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  createCase,
  createWaypoint,
  curateLesson,
  type PlaybookBullet,
  type WaypointCase,
  type HintOutcome,
  type WaypointHint,
} from "@waypoint/core";
import { SqliteStore } from "@waypoint/server";

// --- Tiny terminal helpers ---------------------------------------------------

function header(title: string): void {
  const bar = "=".repeat(Math.max(8, title.length + 8));
  console.log(`\n${bar}\n  ${title}\n${bar}`);
}

function kv(label: string, value: unknown): void {
  console.log(`  ${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
}

// --- Anthropic completion shim ----------------------------------------------
// `@waypoint/core` already calls Anthropic internally for `hint()` — that
// covers step 2. For step 5 we want to curate a lesson out-of-band, which
// also needs a chat-style completion. Wire one up the same way core does
// so the example only requires `ANTHROPIC_API_KEY` and no extra SDK.

const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

async function anthropicComplete(input: {
  system: string;
  user: string;
}): Promise<string> {
  const key = process.env["ANTHROPIC_API_KEY"];
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 512,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// --- Demo --------------------------------------------------------------------

async function main(): Promise<void> {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    console.error(
      "Missing ANTHROPIC_API_KEY. Run: ANTHROPIC_API_KEY=sk-... npx tsx examples/basic-hint/index.ts"
    );
    process.exitCode = 1;
    return;
  }

  // Keep the demo DB next to the example so "fresh run" is just `rm`.
  const here = dirname(fileURLToPath(import.meta.url));
  const dbPath = join(here, ".waypoint", "playbook.db");
  const store = new SqliteStore({ dbPath });
  const waypoint = createWaypoint({ store, model: ANTHROPIC_MODEL });

  // ---------------------------------------------------------------------------
  header("Step 1 — Build a WaypointCase (realistic coding failure)");

  const waypointCase: WaypointCase = createCase({
    task: {
      type: "code",
      content:
        "Implement `fetchAllUsers(client)` that returns every user from a paginated REST API. Each call returns at most 100 users plus a `nextCursor` (null when finished).",
      successCriteria:
        "Must walk the cursor until exhausted — must NOT assume a fixed number of pages.",
    },
    attempt: {
      attemptNumber: 1,
      timestamp: new Date(),
      content: [
        "async function fetchAllUsers(client) {",
        "  const users = [];",
        "  for (let page = 0; page < 10; page++) {",
        "    const res = await client.get('/users', { page });",
        "    users.push(...res.users);",
        "  }",
        "  return users;",
        "}",
      ].join("\n"),
      failureSignal:
        "Integration test 'fetches all users when there are 1,400' fails: function returns 1,000 users, ignoring the `nextCursor` field on the response.",
    },
    agentId: "demo-agent",
  });

  kv("case id", waypointCase.id);
  kv("task type", waypointCase.task.type);
  kv("failure signal", waypointCase.attempt.failureSignal);

  // ---------------------------------------------------------------------------
  header("Step 2 — waypoint.hint(case) — generate a hint via Anthropic");

  const hint: WaypointHint = await waypoint.hint(waypointCase);
  console.log(`  ${hint.content}`);
  console.log();
  kv("hint id", hint.id);
  kv("target concept", hint.targetConcept);
  kv("recommendation", hint.recommendation);
  kv("signalCreation", hint.quality.signalCreation.toFixed(2));
  kv("signalTransfer", hint.quality.signalTransfer.toFixed(2));
  kv("confidence", hint.quality.confidence.toFixed(2));

  // ---------------------------------------------------------------------------
  header("Step 3 — Simulate a successful retry (mock the agent output)");

  const finalOutput = [
    "async function fetchAllUsers(client) {",
    "  const users = [];",
    "  let cursor = null;",
    "  do {",
    "    const res = await client.get('/users', { cursor });",
    "    users.push(...res.users);",
    "    cursor = res.nextCursor;",
    "  } while (cursor !== null);",
    "  return users;",
    "}",
  ].join("\n");

  console.log("  Pretend the agent re-ran with the hint in scope and produced:");
  console.log();
  console.log(
    finalOutput
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n")
  );

  // ---------------------------------------------------------------------------
  header("Step 4 — waypoint.recordOutcome(outcome)");

  const outcome: HintOutcome = {
    hintId: hint.id,
    caseId: waypointCase.id,
    succeeded: true,
    hintReferenced: false,
    attemptsAfterHint: 1,
    finalOutput,
    timeToSuccessMs: 4_200,
    recordedAt: new Date(),
  };

  await waypoint.recordOutcome(outcome);
  kv("succeeded", outcome.succeeded);
  kv("attemptsAfterHint", outcome.attemptsAfterHint);
  kv("hintReferenced", outcome.hintReferenced);
  console.log("  Outcome recorded — reliance has been judged and saved.");

  // ---------------------------------------------------------------------------
  header("Step 5 — Curate a Playbook lesson from this case");

  // `createWaypoint` (convenience API) records outcomes but doesn't curate —
  // curation lives in `@waypoint/core/playbook`. Wire it up explicitly so
  // the example shows the loop end-to-end.
  const bullet: PlaybookBullet | null = await curateLesson(anthropicComplete, {
    waypointCase,
    hint,
    outcome,
    reliance: undefined,
  });

  if (!bullet) {
    console.log("  Curator decided there was no generalisable lesson here.");
  } else {
    await store.appendBullet(bullet);
    console.log(`  ${bullet.content}`);
    console.log();
    kv("bullet id", bullet.id);
    kv("category", bullet.category);
    kv("task types", bullet.taskTypes);
    kv("target concept", bullet.targetConcept);
  }

  // ---------------------------------------------------------------------------
  header("Step 6 — Inspect the Playbook (store.listBullets)");

  const playbook = await store.listBullets();
  console.log(`  ${playbook.length} bullet(s) in the Playbook.`);
  for (const b of playbook) {
    console.log();
    console.log(`  - ${b.content}`);
    console.log(`    category=${b.category} taskTypes=${b.taskTypes.join(",")} concept=${b.targetConcept}`);
    console.log(
      `    helpful=${b.helpfulCount} harmful=${b.harmfulCount} neutral=${b.neutralCount}`
    );
  }

  console.log();
  console.log(`Playbook persisted to: ${dbPath}`);
  console.log("Run the example again to watch the Playbook grow.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
