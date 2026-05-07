import { describe, expect, it } from "vitest";
import type { PlaybookBullet } from "./bullet.js";
import type { TaskType } from "../models/task.js";
import { getRelevantBullets } from "./retrieval.js";

function bullet(
  partial: Omit<PlaybookBullet, "id" | "createdAt" | "lastSeenAt"> & {
    id?: string;
  }
): PlaybookBullet {
  const now = new Date();
  return {
    id: partial.id ?? crypto.randomUUID(),
    createdAt: now,
    lastSeenAt: now,
    ...partial,
  };
}

describe("getRelevantBullets", () => {
  it("filters net-negative bullets and ranks by helpful minus harmful", () => {
    const taskType: TaskType = "code";
    const all: PlaybookBullet[] = [
      bullet({
        content: "bad net",
        category: "failure_pattern",
        taskTypes: ["code"],
        targetConcept: "x",
        helpfulCount: 1,
        harmfulCount: 3,
        neutralCount: 0,
        sourceHintId: "h1",
        sourceCaseId: "c1",
      }),
      bullet({
        content: "best",
        category: "task_strategy",
        taskTypes: ["code"],
        targetConcept: "y",
        helpfulCount: 5,
        harmfulCount: 0,
        neutralCount: 0,
        sourceHintId: "h2",
        sourceCaseId: "c2",
      }),
      bullet({
        content: "mid",
        category: "tool_usage",
        taskTypes: ["code"],
        targetConcept: "z",
        helpfulCount: 2,
        harmfulCount: 1,
        neutralCount: 0,
        sourceHintId: "h3",
        sourceCaseId: "c3",
      }),
      bullet({
        content: "wrong task type",
        category: "task_strategy",
        taskTypes: ["writing"],
        targetConcept: "w",
        helpfulCount: 99,
        harmfulCount: 0,
        neutralCount: 0,
        sourceHintId: "h4",
        sourceCaseId: "c4",
      }),
    ];
    const got = getRelevantBullets(all, taskType, 5);
    expect(got.map((b) => b.content)).toEqual(["best", "mid"]);
  });
});
