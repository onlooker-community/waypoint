import type { WaypointCase } from "../../models/case.js";
import type { WaypointHint } from "../../models/hint.js";
import type { HintOutcome } from "../../models/outcome.js";
import type { RelianceScore } from "../../models/reliance.js";

export const CURATOR_SYSTEM = `You are a curriculum curator for an AI coding assistant system (ACE-style).

Given a task, the hint that was given, the outcome, and an optional reliance assessment, extract ONE generalizable playbook lesson.

Critical constraint (from ACE): output a transferable lesson — a pattern an agent should recognize and act on — NOT a narrative of what happened in this session.

Bad: "The agent failed because the tests timed out."
Good: "When integration tests hang, isolate network calls with test doubles before chasing logic bugs."

Respond with JSON only (no markdown fences):
{
  "skip": boolean,
  "content": string | null,
  "category": "failure_pattern" | "successful_hint" | "task_strategy" | "tool_usage" | null,
  "taskTypes": ("code" | "reasoning" | "writing" | "general")[] | null,
  "targetConcept": string | null
}

Set skip to true when there is nothing generalizable or the lesson would duplicate obvious instructions.

Reliance interpretation:
- Low reliance + success → prefer task_strategy or successful_hint (the agent nearly succeeded; capture what was learnable).
- High reliance + success → failure_pattern style lesson about the capability gap or misconception.
- Failure after hint → failure_pattern or tool_usage — why the hint did not suffice.

taskTypes should usually include the case's task type; add others only when the lesson clearly generalizes.`;

export function buildCuratorUserMessage(input: {
  waypointCase: WaypointCase;
  hint: WaypointHint;
  outcome: HintOutcome;
  reliance: RelianceScore | undefined;
}): string {
  const { waypointCase, hint, outcome, reliance } = input;
  const parts = [
    `## Task (${waypointCase.task.type})`,
    waypointCase.task.content,
    waypointCase.task.context
      ? `\n### Context\n${waypointCase.task.context}`
      : "",
    `\n### Attempt failure signal\n${waypointCase.attempt.failureSignal}`,
    `\n### Hint given (target: ${hint.targetConcept})\n${hint.content}`,
    `\n## Outcome`,
    `- succeeded: ${outcome.succeeded}`,
    `- hintReferenced: ${outcome.hintReferenced}`,
    `- attemptsAfterHint: ${outcome.attemptsAfterHint}`,
    outcome.finalOutput
      ? `\n### Final output (excerpt)\n${truncate(outcome.finalOutput, 4000)}`
      : "",
    reliance
      ? `\n## Reliance\n${JSON.stringify(
          {
            score: reliance.score,
            assessment: reliance.assessment,
            method: reliance.method,
            reasoning: reliance.reasoning,
            hintExplicitlyReferenced: reliance.hintExplicitlyReferenced,
          },
          null,
          2
        )}`
      : "\n## Reliance\n(not measured — no final output or skipped)",
  ];
  return parts.filter(Boolean).join("\n");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max)}…`;
}
