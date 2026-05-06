import type { AgentCapabilityProfile } from "../models/profile.js";
import {
  TaskTypeStatsSchema,
  type TaskTypeStats,
} from "../models/profile.js";
import type { HintOutcome } from "../models/outcome.js";
import type { TaskType } from "../models/task.js";
import type { RelianceScore } from "../models/reliance.js";

function mergeTaskTypeStats(
  prev: TaskTypeStats,
  outcome: HintOutcome,
  reliance: RelianceScore | undefined
): TaskTypeStats {
  const newTotal = prev.totalCases + 1;
  const successDelta = outcome.succeeded ? 1 : 0;
  const successRate =
    (prev.successRate * prev.totalCases + successDelta) / newTotal;

  const attempts = outcome.attemptsAfterHint;
  const prevSuccessCount = Math.round(prev.successRate * prev.totalCases);
  let averageAttemptsToSuccess = prev.averageAttemptsToSuccess;
  if (outcome.succeeded) {
    const newSuccessCount = prevSuccessCount + 1;
    averageAttemptsToSuccess =
      (prev.averageAttemptsToSuccess * prevSuccessCount + attempts) /
      newSuccessCount;
  }

  const rel = reliance?.score;
  const averageReliance =
    rel !== undefined
      ? (prev.averageReliance * prev.totalCases + rel) / newTotal
      : prev.averageReliance;

  const hintWinDelta = outcome.succeeded ? 1 : 0;
  const hintSuccessRate =
    (prev.hintSuccessRate * prev.totalCases + hintWinDelta) / newTotal;

  return TaskTypeStatsSchema.parse({
    totalCases: newTotal,
    successRate,
    averageAttemptsToSuccess,
    averageReliance,
    hintSuccessRate,
  });
}

/**
 * Rolls outcome (+ optional reliance) into rolling averages on the profile.
 */
export function mergeOutcomeIntoProfile(
  profile: AgentCapabilityProfile,
  taskType: TaskType,
  outcome: HintOutcome,
  reliance: RelianceScore | undefined
): AgentCapabilityProfile {
  const prevOverall = profile.overall;
  const newOverall = mergeTaskTypeStats(prevOverall, outcome, reliance);

  const prevByType =
    profile.byTaskType[taskType] ??
    TaskTypeStatsSchema.parse({ totalCases: 0 });
  const newByType = mergeTaskTypeStats(prevByType, outcome, reliance);

  return {
    ...profile,
    overall: newOverall,
    byTaskType: {
      ...profile.byTaskType,
      [taskType]: newByType,
    },
    lastUpdated: new Date(),
    sessionCount: profile.sessionCount + 1,
  };
}
