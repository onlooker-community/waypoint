import type { WaypointCase } from "../../models/case.js";

export function buildDiagnosePrompt(waypointCase: WaypointCase): string {
  const { task, attempt } = waypointCase;

  return `You are a precise failure analyst. Your job is to identify exactly why an AI agent failed a task.

Be surgical. Do not be encouraging. Do not suggest fixes yet. Just diagnose.

## Task
Type: ${task.type}
${task.context ? `Context:\n${task.context}\n` : ""}
${task.successCriteria ? `Success criteria:\n${task.successCriteria}\n` : ""}

Content:
${task.content}

## Agent's Failed Attempt (Attempt #${attempt.attemptNumber})
${attempt.content}

## Failure Signal
${attempt.failureSignal}

## Your Diagnosis

Identify:
1. FAILURE_TYPE: One of: wrong_approach | missing_concept | implementation_error | misunderstood_task | out_of_scope
2. ROOT_CAUSE: The single most specific reason this failed. One sentence.
3. MISSING_INSIGHT: The concept, pattern, or technique the agent is not applying. Be specific.
4. HINT_DIRECTION: The category of nudge that would help most. One of: reframe | missing_tool | intermediate_goal | alternative_representation | constraint_reminder

Respond in this exact format:
<diagnosis>
  <failure_type>VALUE</failure_type>
  <root_cause>VALUE</root_cause>
  <missing_insight>VALUE</missing_insight>
  <hint_direction>VALUE</hint_direction>
</diagnosis>`;
}

export type HintDirection =
  | "reframe"
  | "missing_tool"
  | "intermediate_goal"
  | "alternative_representation"
  | "constraint_reminder";

export type FailureType =
  | "wrong_approach"
  | "missing_concept"
  | "implementation_error"
  | "misunderstood_task"
  | "out_of_scope";

export interface Diagnosis {
  failureType: FailureType;
  rootCause: string;
  missingInsight: string;
  hintDirection: HintDirection;
}