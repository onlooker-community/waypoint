export function buildJudgePrompt(
  task: string,
  hint: string,
  output: string
): string {
  return `You are evaluating whether an agent's successful output depended on a hint it was given, or whether it could have produced that output independently.

## The Task
${task}

## The Hint That Was Provided
${hint}

## The Agent's Output
${output}

## Your Job
Estimate how much the agent's output relied on the hint vs. what it could have reasoned independently.

Ask yourself:
- Does the output reference the hint explicitly? (strong reliance signal)
- Does the output use specific values, formulations, or steps that only appeared in the hint?
- Could a capable agent have reached this output without the hint?
- Is the hint's contribution conceptual (low reliance) or computational (high reliance)?

## Scoring
0.0 = Output is entirely independent — hint was irrelevant or redundant
0.25 = Hint oriented the approach but agent did all the reasoning
0.5 = Hint meaningfully scaffolded the solution — borderline
0.75 = Output depends heavily on the hint's specific content
1.0 = Output is essentially a transcription of the hint

## Output Format
<reliance_assessment>
  <score>A number between 0.0 and 1.0</score>
  <hint_explicitly_referenced>true or false</hint_explicitly_referenced>
  <reasoning>One or two sentences explaining the score</reasoning>
</reliance_assessment>`;
}

export interface JudgeResult {
  score: number;
  hintExplicitlyReferenced: boolean;
  reasoning: string;
}