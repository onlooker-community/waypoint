import { z } from "zod";

export const TaskTypeSchema = z.enum([
  "code",
  "reasoning",
  "writing",
  "general",
]);

export type TaskType = z.infer<typeof TaskTypeSchema>;

export const TaskSchema = z.object({
  // The question, prompt, ticket, instruction — whatever is being attempted
  content: z.string().min(1),

  type: TaskTypeSchema,

  // Surrounding context: file contents, codebase info, conversation history
  // Kept separate from content so the hinter can reason about them independently
  context: z.string().optional(),

  // What success looks like: test suite output, acceptance criteria, rubric
  // Maps to "reference solution" in the HiLL paper — available at hint time,
  // never shown to the reasoner directly
  successCriteria: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;