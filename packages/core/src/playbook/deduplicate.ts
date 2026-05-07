import type { TaskType } from "../models/task.js";
import type { WaypointStore } from "../store/types.js";
import type { PlaybookBullet } from "./bullet.js";
import { PLAYBOOK_DEDUP_THRESHOLD } from "./constants.js";
import { parseJsonFromModel } from "./json-parse.js";
import {
  buildDedupUserMessage,
  DEDUP_SYSTEM,
} from "./prompts/dedup.js";
import { z } from "zod";

const DedupDecisionSchema = z.object({
  redundant: z.boolean(),
  keepId: z.string().nullable(),
  dropId: z.string().nullable(),
});

export type DedupComplete = (input: {
  system: string;
  user: string;
}) => Promise<string>;

function bulletsForTaskType(
  bullets: PlaybookBullet[],
  taskType: TaskType
): PlaybookBullet[] {
  return bullets.filter((b) => b.taskTypes.includes(taskType));
}

function netScore(b: PlaybookBullet): number {
  return b.helpfulCount - b.harmfulCount;
}

const MAX_DEDUP_ITERATIONS = 200;

/**
 * Shrinks the playbook for this task type until at most PLAYBOOK_DEDUP_THRESHOLD
 * bullets apply, only removing bullets the LLM marks as redundant with another.
 */
export async function deduplicateTaskTypeIfNeeded(
  store: WaypointStore,
  taskType: TaskType,
  complete: DedupComplete
): Promise<void> {
  let iterations = 0;
  while (iterations < MAX_DEDUP_ITERATIONS) {
    const pool = bulletsForTaskType(await store.listBullets(), taskType);
    if (pool.length <= PLAYBOOK_DEDUP_THRESHOLD) {
      return;
    }
    iterations++;
    pool.sort((a, b) => netScore(a) - netScore(b));
    let removed = false;
    outer: for (let i = 0; i < pool.length - 1; i++) {
      for (let j = i + 1; j < Math.min(i + 8, pool.length); j++) {
        const a = pool[i];
        const b = pool[j];
        if (!a || !b || a.id === b.id) {
          continue;
        }
        const raw = await complete({
          system: DEDUP_SYSTEM,
          user: buildDedupUserMessage(a, b),
        });
        const decision = parseJsonFromModel(raw, DedupDecisionSchema);
        if (
          decision.redundant &&
          decision.dropId &&
          [a.id, b.id].includes(decision.dropId)
        ) {
          await store.deleteBullet(decision.dropId);
          removed = true;
          break outer;
        }
      }
    }
    if (!removed) {
      return;
    }
  }
}
