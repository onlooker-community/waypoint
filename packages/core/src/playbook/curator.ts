import { z } from "zod";
import type { WaypointCase } from "../models/case.js";
import type { WaypointHint } from "../models/hint.js";
import type { HintOutcome } from "../models/outcome.js";
import type { RelianceScore } from "../models/reliance.js";
import { TaskTypeSchema } from "../models/task.js";
import {
  createPlaybookBullet,
  PlaybookBulletCategorySchema,
  type PlaybookBullet,
} from "./bullet.js";
import { parseJsonFromModel } from "./json-parse.js";
import { buildCuratorUserMessage, CURATOR_SYSTEM } from "./prompts/curator.js";

const CuratorOutputSchema = z.object({
  skip: z.boolean(),
  content: z.string().nullable(),
  category: PlaybookBulletCategorySchema.nullable(),
  taskTypes: z.array(TaskTypeSchema).nullable(),
  targetConcept: z.string().nullable(),
});

export type CuratorComplete = (input: {
  system: string;
  user: string;
}) => Promise<string>;

export async function curateLesson(
  complete: CuratorComplete,
  input: {
    waypointCase: WaypointCase;
    hint: WaypointHint;
    outcome: HintOutcome;
    reliance: RelianceScore | undefined;
  }
): Promise<PlaybookBullet | null> {
  const raw = await complete({
    system: CURATOR_SYSTEM,
    user: buildCuratorUserMessage(input),
  });
  const parsed = parseJsonFromModel(raw, CuratorOutputSchema);
  if (
    parsed.skip ||
    !parsed.content?.trim() ||
    !parsed.category ||
    !parsed.taskTypes?.length ||
    !parsed.targetConcept?.trim()
  ) {
    return null;
  }
  return createPlaybookBullet({
    id: crypto.randomUUID(),
    content: parsed.content.trim(),
    category: parsed.category,
    taskTypes: parsed.taskTypes,
    targetConcept: parsed.targetConcept.trim(),
    helpfulCount: 0,
    harmfulCount: 0,
    neutralCount: 0,
    sourceHintId: input.hint.id,
    sourceCaseId: input.outcome.caseId,
  });
}
