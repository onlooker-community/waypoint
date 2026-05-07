import { judgeReliance } from "./judge.js";
import type { RelianceScore } from "../models/reliance.js";

export interface MeasureRelianceOptions {
  // Force a specific method — defaults to judge (logprob requires adapter support)
  method?: "logprob" | "judge";

  // If method is logprob, the adapter must provide this function
  logprobFn?: (
    task: string,
    hint: string,
    output: string
  ) => Promise<number>;
}

export async function measureReliance(
  task: string,
  hint: string,
  output: string,
  options: MeasureRelianceOptions = {}
): Promise<RelianceScore> {
  const { method = "judge", logprobFn } = options;

  if (method === "logprob" && logprobFn) {
    const score = await logprobFn(task, hint, output);
    return {
      score: Math.max(0, Math.min(1, score)),
      assessment: scoreToAssessment(score),
      method: "logprob",
      reasoning: "Computed via log probability comparison",
      hintExplicitlyReferenced: false, // Not measurable via logprob
    };
  }

  // Default: judge model
  return judgeReliance(task, hint, output);
}

function scoreToAssessment(score: number): RelianceScore["assessment"] {
  if (score < 0.35) return "low";
  if (score < 0.65) return "medium";
  return "high";
}

export { judgeReliance } from "./judge.js";