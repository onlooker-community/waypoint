import type { AgentCapabilityProfile, TaskTypeStats } from "../models/profile.js";
import type { HintOutcome } from "../models/outcome.js";
import type { TaskType } from "../models/task.js";
import { createEmptyProfile } from "../models/profile.js";

export function updateProfile(
  profile: AgentCapabilityProfile,
  outcome: HintOutcome,
  taskType: TaskType
): AgentCapabilityProfile {
  const existing = profile.byTaskType[taskType] ?? emptyStats();
  const updated = updateStats(existing, outcome);

  const byTaskType = { ...profile.byTaskType, [taskType]: updated };
  const overall = recomputeOverall(byTaskType);

  const strengths = computeStrengths(byTaskType);
  const weaknesses = computeWeaknesses(byTaskType);

  return {
    ...profile,
    byTaskType,
    overall,
    strengths,
    weaknesses,
    lastUpdated: new Date(),
    sessionCount: profile.sessionCount + (outcome.attemptsAfterHint === 0 ? 1 : 0),
  };
}

function updateStats(
  stats: TaskTypeStats,
  outcome: HintOutcome
): TaskTypeStats {
  const n = stats.totalCases + 1;
  const prevSuccessRate = stats.successRate;
  const prevHintSuccessRate = stats.hintSuccessRate;
  const prevReliance = stats.averageReliance;
  const prevAttempts = stats.averageAttemptsToSuccess;

  // Rolling average updates
  const newSuccessRate = rollingAvg(prevSuccessRate, outcome.succeeded ? 1 : 0, n);
  const newHintSuccessRate = rollingAvg(
    prevHintSuccessRate,
    outcome.succeeded ? 1 : 0,
    n
  );
  const newReliance = outcome.hintReferenced
    ? rollingAvg(prevReliance, 1.0, n)
    : rollingAvg(prevReliance, 0.2, n);
  const newAttempts = rollingAvg(
    prevAttempts,
    outcome.attemptsAfterHint + 1,
    n
  );

  return {
    totalCases: n,
    successRate: newSuccessRate,
    averageAttemptsToSuccess: newAttempts,
    averageReliance: newReliance,
    hintSuccessRate: newHintSuccessRate,
  };
}

function recomputeOverall(
  byTaskType: Partial<Record<TaskType, TaskTypeStats>>
): TaskTypeStats {
  const allStats = Object.values(byTaskType).filter(
    (s): s is TaskTypeStats => s !== undefined
  );

  if (allStats.length === 0) return emptyStats();

  const totalCases = allStats.reduce((sum, s) => sum + s.totalCases, 0);

  const weightedAvg = (key: keyof TaskTypeStats): number => {
    if (totalCases === 0) return 0;
    return (
      allStats.reduce((sum, s) => sum + (s[key] as number) * s.totalCases, 0) /
      totalCases
    );
  };

  return {
    totalCases,
    successRate: weightedAvg("successRate"),
    averageAttemptsToSuccess: weightedAvg("averageAttemptsToSuccess"),
    averageReliance: weightedAvg("averageReliance"),
    hintSuccessRate: weightedAvg("hintSuccessRate"),
  };
}

function computeStrengths(
  byTaskType: Partial<Record<TaskType, TaskTypeStats>>
): TaskType[] {
  return (Object.entries(byTaskType) as [TaskType, TaskTypeStats][])
    .filter(([, stats]) => stats.successRate >= 0.7 && stats.totalCases >= 3)
    .map(([type]) => type);
}

function computeWeaknesses(
  byTaskType: Partial<Record<TaskType, TaskTypeStats>>
): TaskType[] {
  return (Object.entries(byTaskType) as [TaskType, TaskTypeStats][])
    .filter(([, stats]) => stats.successRate < 0.4 && stats.totalCases >= 3)
    .map(([type]) => type);
}

function rollingAvg(prev: number, next: number, n: number): number {
  return (prev * (n - 1) + next) / n;
}

function emptyStats(): TaskTypeStats {
  return {
    totalCases: 0,
    successRate: 0,
    averageAttemptsToSuccess: 0,
    averageReliance: 0,
    hintSuccessRate: 0,
  };
}

export { createEmptyProfile };
