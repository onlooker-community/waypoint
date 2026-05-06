import { z } from "zod";
import type { RelianceScore } from "../models/reliance.js";
import { RelianceScoreSchema } from "../models/reliance.js";
import { parseJsonFromModel } from "../playbook/json-parse.js";

const RelianceJudgeOutputSchema = z.object({
  score: z.number().min(0).max(1),
  assessment: z.enum(["low", "medium", "high"]),
  reasoning: z.string(),
  hintExplicitlyReferenced: z.boolean(),
});

export type CompleteFn = (input: {
  system: string;
  user: string;
}) => Promise<string>;

const RELIANCE_JUDGE_SYSTEM = `You estimate how much a model's final output depended on a specific hint.

Score 0 = the output would be equally likely without the hint (full transfer).
Score 1 = the output is entirely attributable to following the hint (no transfer).

Respond with JSON only:
{
  "score": number between 0 and 1,
  "assessment": "low" | "medium" | "high",
  "reasoning": string,
  "hintExplicitlyReferenced": boolean
}

Use assessment: low if score < 0.34, medium if 0.34–0.66, high if > 0.66.`;

export async function judgeRelianceWithModel(
  complete: CompleteFn,
  input: { task: string; hint: string; output: string }
): Promise<RelianceScore> {
  const user = `## Task\n${input.task}\n\n## Hint given\n${input.hint}\n\n## Final output\n${input.output}`;
  const raw = await complete({
    system: RELIANCE_JUDGE_SYSTEM,
    user,
  });
  const parsed = parseJsonFromModel(raw, RelianceJudgeOutputSchema);
  return RelianceScoreSchema.parse({
    ...parsed,
    method: "judge",
  });
}
