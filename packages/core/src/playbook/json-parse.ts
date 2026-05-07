import type { ZodType } from "zod";

/**
 * Parses JSON from raw LLM output, including ```json fenced blocks.
 */
export function parseJsonFromModel<T>(raw: string, schema: ZodType<T>): T {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = (fence?.[1] ?? trimmed).trim();
  const parsed: unknown = JSON.parse(jsonStr);
  return schema.parse(parsed);
}
