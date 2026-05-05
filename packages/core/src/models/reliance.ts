import { z } from "zod";

export const RelianceAssessmentSchema = z.enum(["low", "medium", "high"]);

export type RelianceAssessment = z.infer<typeof RelianceAssessmentSchema>;

export const RelianceScoreSchema = z.object({
  // 0-1 continuous score
  // 0 = output equally likely with or without hint (fully transferable)
  // 1 = output entirely dependent on hint (no transfer)
  // Maps to rho_c(q, h) normalized to [0,1] from the HiLL paper
  score: z.number().min(0).max(1),

  assessment: RelianceAssessmentSchema,

  // How the score was computed
  method: z.enum([
    "logprob",  // direct log probability comparison — most accurate
    "judge",    // judge model fallback — used when log probs unavailable
  ]),

  // The judge's or system's reasoning — useful for debugging prompts
  reasoning: z.string(),

  // Whether the output explicitly referenced the hint
  // e.g. "Given the hint, ..." is a strong reliance signal
  // Tracked separately from the score because it's a discrete signal
  hintExplicitlyReferenced: z.boolean(),
});

export type RelianceScore = z.infer<typeof RelianceScoreSchema>;