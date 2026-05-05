import { z } from "zod";
import { TaskSchema } from "./task.js";
import { AttemptSchema } from "./attempt.js";

export const WaypointCaseSchema = z.object({
  id: z.string().min(1),

  task: TaskSchema,

  attempt: AttemptSchema,

  // Which agent/session this came from
  // Used to build AgentCapabilityProfile over time
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
});

export type WaypointCase = z.infer<typeof WaypointCaseSchema>;

// Convenience constructor — callers shouldn't have to think about IDs
export function createCase(
  input: Omit<WaypointCase, "id">
): WaypointCase {
  return WaypointCaseSchema.parse({
    id: crypto.randomUUID(),
    ...input,
  });
}