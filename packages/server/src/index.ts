import { Hono } from "hono";
import { serve } from "@hono/node-server";
import {
	createWaypoint,
	WaypointCaseSchema,
	HintOutcomeSchema,
	WaypointHintSchema,
	RelianceScoreSchema,
} from "@waypoint/core";
import { z } from "zod";
import { authMiddleware } from "./middleware/auth.js";
import { FileStore } from "./store/file.js";

const app = new Hono();

const storePath = process.env["WAYPOINT_STORE_PATH"] ?? ".waypoint/store.json";
const waypoint = createWaypoint({ store: new FileStore(storePath) });

app.use("*", authMiddleware);

app.post("/hint", async (c) => {
	const raw = await c.req.json();
	const waypointCase = WaypointCaseSchema.parse(raw);
	const hint = await waypoint.hint(waypointCase);

	return c.json(WaypointHintSchema.parse(hint));
});

app.post("/reliance", async (c) => {
	const raw = await c.req.json();
	const body = z
		.object({
			task: z.string().min(1),
			hint: z.string().min(1),
			output: z.string().min(1),
			method: z.enum(["logprob", "judge"]).optional(),
		})
		.parse(raw);

	const reliance = await waypoint.measureReliance(
		body.task,
		body.hint,
		body.output,
		body.method
	);
	return c.json(RelianceScoreSchema.parse(reliance));
});

app.post("/outcome", async (c) => {
	const raw = await c.req.json();
	const outcome = HintOutcomeSchema.parse(raw);

	await waypoint.recordOutcome(outcome);
	return c.body(null, 204);
});

app.get("/profile/:agentId", async (c) => {
	const params = z.object({ agentId: z.string().min(1) }).parse(c.req.param());
	const profile = await waypoint.getAgentProfile(params.agentId);
	return c.json(profile);
});

app.onError((err, c) => {
	if (err instanceof z.ZodError) {
		return c.json({ error: "Invalid request", details: err.issues }, 400);
	}

	return c.json({ error: err.message }, 500);
});

if (import.meta.url === `file://${process.argv[1]}`) {
	const port = Number(process.env["PORT"] ?? 8787);
	serve({ fetch: app.fetch, port });
	console.log(`Waypoint server listening on :${port}`);
}

export default app;

// Public store exports — consumers (CLI, tests, custom servers) can use these
// directly to back a Waypoint instance.
export { FileStore } from "./store/file.js";
export { SqliteStore, type SqliteStoreOptions } from "./store/sqlite.js";
