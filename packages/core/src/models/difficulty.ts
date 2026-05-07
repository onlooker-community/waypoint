import { z } from "zod";
import { TaskTypeSchema } from "./task.js";

export const DifficultyLevelSchema = z.enum([
  "easy",         // model will likely solve without help — don't hint
  "medium",       // retry first, hint if needed
  "hard",         // activate hinter immediately
  "out_of_scope", // beyond capability boundary — escalate to human
]);

export type DifficultyLevel = z.infer<typeof DifficultyLevelSchema>;

export const DifficultyEstimateSchema = z.object({
  level: DifficultyLevelSchema,

  // 0-1 continuous difficulty score
  // Useful for soft routing decisions and logging
  score: z.number().min(0).max(1),

  // Why this difficulty was assigned
  reasoning: z.string(),

  // Should Waypoint intervene at all?
  // False for easy tasks and out_of_scope tasks (for different reasons)
  shouldHint: z.boolean(),

  // What type of hint would be most useful given the task type
  // Informs hint generation strategy
  suggestedTaskType: TaskTypeSchema.optional(),
});

export type DifficultyEstimate = z.infer<typeof DifficultyEstimateSchema>;