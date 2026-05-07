import { z } from "zod";
import { TaskTypeSchema } from "../models/task.js";

export const PlaybookBulletCategorySchema = z.enum([
  "failure_pattern",
  "successful_hint",
  "task_strategy",
  "tool_usage",
]);

export type PlaybookBulletCategory = z.infer<
  typeof PlaybookBulletCategorySchema
>;

export const PlaybookBulletSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  category: PlaybookBulletCategorySchema,
  taskTypes: z.array(TaskTypeSchema).min(1),
  targetConcept: z.string().min(1),
  helpfulCount: z.number().int().min(0).default(0),
  harmfulCount: z.number().int().min(0).default(0),
  neutralCount: z.number().int().min(0).default(0),
  sourceHintId: z.string().min(1),
  sourceCaseId: z.string().min(1),
  createdAt: z.date(),
  lastSeenAt: z.date(),
});

export type PlaybookBullet = z.infer<typeof PlaybookBulletSchema>;

export function createPlaybookBullet(
  input: Omit<PlaybookBullet, "createdAt" | "lastSeenAt"> & {
    createdAt?: Date;
    lastSeenAt?: Date;
  }
): PlaybookBullet {
  const now = new Date();
  return PlaybookBulletSchema.parse({
    ...input,
    createdAt: input.createdAt ?? now,
    lastSeenAt: input.lastSeenAt ?? now,
  });
}
