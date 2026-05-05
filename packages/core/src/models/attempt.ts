import { z } from "zod";

export const AttemptSchema = z.object({
  // What the primary agent actually produced
  content: z.string().min(1),

  // The signal that tells us this attempt failed:
  // compiler error, test failure, rejection reason, judge score etc.
  // Maps to the "incorrect rollout" in the HiLL paper
  failureSignal: z.string().min(1),

  // Which attempt this is — used for difficulty routing
  // (if it's attempt 5, escalate rather than keep hinting)
  attemptNumber: z.number().int().min(1).default(1),

  // When this attempt was made — useful for profiling over time
  timestamp: z.date().default(() => new Date()),
});

export type Attempt = z.infer<typeof AttemptSchema>;