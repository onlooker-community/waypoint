import type { Task } from "../../models/task.js";

export function buildDifficultyPrompt(
  task: Task,
  previousAttempts: number = 0
): string {
  return `You are estimating whether an AI agent is likely to get stuck on a task, so we can decide whether to proactively provide a hint.

## Task
Type: ${task.type}
${task.context ? `Context:\n${task.context}\n` : ""}
Content:
${task.content}
${task.successCriteria ? `\nSuccess criteria:\n${task.successCriteria}` : ""}

## Context
Previous failed attempts: ${previousAttempts}

## Difficulty Levels
- easy: A capable agent will solve this on the first or second attempt. No hint needed.
- medium: May require a retry. Hint if it fails once.
- hard: Likely to produce all-incorrect outputs without intervention. Hint immediately.
- out_of_scope: Beyond reasonable agent capability. Escalate to a human — hinting won't help.

## Assessment Criteria
Consider:
- Does solving this require specialist knowledge the agent may lack?
- Does it require multi-step reasoning with many places to go wrong?
- Are there common misconceptions likely to trap the agent?
- Is the task ambiguous in ways that could cause systematic failure?
- Has it already failed multiple times (attempts: ${previousAttempts})?

## Output Format
<difficulty_assessment>
  <level>easy | medium | hard | out_of_scope</level>
  <score>A number between 0.0 and 1.0</score>
  <should_hint>true or false</should_hint>
  <reasoning>One sentence explaining the assessment</reasoning>
</difficulty_assessment>`;
}