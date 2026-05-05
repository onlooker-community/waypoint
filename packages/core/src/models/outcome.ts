import { z } from "zod";

export const HintOutcomeSchema = z.object({
  hintId: z.string().min(1),
  caseId: z.string().min(1),

  // Did the agent eventually succeed after receiving the hint?
  succeeded: z.boolean(),

  // Did the agent's output explicitly reference the hint?
  // e.g. "As suggested, I'll try parameterizing..."
  // High rate of this across sessions = hints are too prescriptive
  hintReferenced: z.boolean(),

  // How many more attempts were needed after the hint
  // 1 = solved on first try after hint (good)
  // 5+ = hint didn't really help (consider escalating)
  attemptsAfterHint: z.number().int().min(0),

  // The final output — used to run reliance measurement post-hoc
  finalOutput: z.string().optional(),

  // How long it took to succeed after hinting, in ms
  // Useful for understanding hint usefulness beyond just correctness
  timeToSuccessMs: z.number().optional(),

  recordedAt: z.date().default(() => new Date()),
});

export type HintOutcome = z.infer<typeof HintOutcomeSchema>;