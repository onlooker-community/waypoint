import type { TaskType } from "../models/task.js";
import type { PlaybookBullet } from "./bullet.js";
import { PLAYBOOK_RETRIEVAL_TOP_K } from "./constants.js";

function netScore(b: PlaybookBullet): number {
  return b.helpfulCount - b.harmfulCount;
}

/**
 * Filters and ranks bullets for hint injection — no vector search.
 */
export function getRelevantBullets(
  all: PlaybookBullet[],
  taskType: TaskType,
  topK: number = PLAYBOOK_RETRIEVAL_TOP_K
): PlaybookBullet[] {
  const filtered = all.filter(
    (b) =>
      b.taskTypes.includes(taskType) && b.harmfulCount <= b.helpfulCount
  );
  filtered.sort((a, b) => netScore(b) - netScore(a));
  return filtered.slice(0, topK);
}
