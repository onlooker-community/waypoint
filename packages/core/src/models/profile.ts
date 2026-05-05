import { z } from "zod";
import { TaskTypeSchema } from "./task.js";

// Per-task-type breakdown of performance
export const TaskTypeStatsSchema = z.object({
  totalCases: z.number().int().min(0).default(0),
  successRate: z.number().min(0).max(1).default(0),
  averageAttemptsToSuccess: z.number().min(0).default(0),
  averageReliance: z.number().min(0).max(1).default(0),
  hintSuccessRate: z.number().min(0).max(1).default(0),
});

export type TaskTypeStats = z.infer<typeof TaskTypeStatsSchema>;

export const AgentCapabilityProfileSchema = z.object({
  agentId: z.string().min(1),

  // Task types the agent handles well — don't hint these aggressively
  strengths: z.array(TaskTypeSchema).default([]),

  // Task types where the agent consistently struggles
  weaknesses: z.array(TaskTypeSchema).default([]),

  // Rolled-up stats across all task types
  overall: TaskTypeStatsSchema.default({}),

  // Per-task-type breakdown
  // Lets routing decisions be more granular than overall stats
  byTaskType: z.record(TaskTypeSchema, TaskTypeStatsSchema).default({}),

  // When this profile was last updated
  // Stale profiles should be treated with lower confidence
  lastUpdated: z.date().default(() => new Date()),

  // Total number of sessions this profile covers
  sessionCount: z.number().int().min(0).default(0),
});

export type AgentCapabilityProfile = z.infer<
  typeof AgentCapabilityProfileSchema
>;

// Empty profile for a new agent — safe defaults
export function createEmptyProfile(agentId: string): AgentCapabilityProfile {
  return AgentCapabilityProfileSchema.parse({ agentId });
}