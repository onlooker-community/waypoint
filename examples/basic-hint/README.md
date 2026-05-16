# `basic-hint` — Waypoint end-to-end demo

This is the "how does Waypoint actually work?" example. One file, six
steps, runs against the real Anthropic API.

## Run it

From the repo root:

```sh
ANTHROPIC_API_KEY=sk-... npx tsx examples/basic-hint/index.ts
```

Or via the workspace `start` script:

```sh
ANTHROPIC_API_KEY=sk-... npm start -w @waypoint/example-basic-hint
```

That is the only required setup. The example uses the workspace versions
of `@waypoint/core` and `@waypoint/server` — `npm install` at the repo
root wires them up.

A single run makes **three Anthropic API calls**: one for `hint`, one
for the post-hoc reliance judge inside `recordOutcome`, and one for
`curateLesson`. Steps 1, 3, and 6 are local.

The Playbook is persisted to `examples/basic-hint/.waypoint/playbook.db`
(a local SQLite file) so re-running the example accumulates lessons
across runs. Delete the directory for a fresh start.

## What each step demonstrates

1. **Build a `WaypointCase`.** A realistic coding failure — an agent
   used `for (let page = 0; page < 10; page++)` for a cursor-paginated
   API and missed everything past 1,000 users. The case bundles task,
   attempt, and failure signal.
2. **`waypoint.hint(case)`.** Waypoint diagnoses the failure and
   generates a conceptual hint via Anthropic. The hint comes back with
   `signalCreation` / `signalTransfer` quality scores and a target
   concept.
3. **Simulate a successful retry.** The example synthesises the
   corrected code directly — that is what you would otherwise capture
   from your agent. No model call.
4. **`waypoint.recordOutcome(outcome)`.** Closes the loop. The store
   saves the outcome, judges reliance against the final output (which
   issues an Anthropic call under the hood), and updates feedback
   counters on any Playbook bullets that fed the hint.
5. **Curate a Playbook lesson.** `curateLesson` from
   `@waypoint/core/playbook` calls the model to distil a transferable
   bullet out of this case + hint + outcome, and
   `SqliteStore.appendBullet` writes it to disk.
6. **Inspect the Playbook.** `store.listBullets()` shows the bullet you
   just added — and any from previous runs, since SQLite persists.

## Why the example calls the curator directly

The convenience `createWaypoint({ store, model })` factory keeps a small
surface area: it generates hints and records outcomes. Curation lives in
`@waypoint/core/playbook` so adapters can decide when to run it
themselves. The example wires it up in step 5 so you can see the whole
loop, including the bit that builds the Playbook.
