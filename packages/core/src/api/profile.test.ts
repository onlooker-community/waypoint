import { describe, it, expect } from "vitest";
import { updateProfile, createEmptyProfile } from "./profile.js";
import type { HintOutcome } from "../models/outcome.js";

const BASE_OUTCOME: HintOutcome = {
  hintId: "hint-1",
  caseId: "case-1",
  succeeded: true,
  hintReferenced: false,
  attemptsAfterHint: 1,
  recordedAt: new Date(),
};

describe("createEmptyProfile", () => {
  it("creates a profile with the given agentId", () => {
    const profile = createEmptyProfile("agent-1");
    expect(profile.agentId).toBe("agent-1");
  });

  it("starts with zero total cases", () => {
    const profile = createEmptyProfile("agent-1");
    expect(profile.overall.totalCases).toBe(0);
  });

  it("starts with empty strengths and weaknesses", () => {
    const profile = createEmptyProfile("agent-1");
    expect(profile.strengths).toEqual([]);
    expect(profile.weaknesses).toEqual([]);
  });

  it("starts with zero session count", () => {
    const profile = createEmptyProfile("agent-1");
    expect(profile.sessionCount).toBe(0);
  });
});

describe("updateProfile", () => {
  it("increments totalCases for the given task type", () => {
    const profile = createEmptyProfile("agent-1");
    const updated = updateProfile(profile, BASE_OUTCOME, "code");
    expect(updated.byTaskType["code"]?.totalCases).toBe(1);
  });

  it("sets successRate to 1 after a single success", () => {
    const profile = createEmptyProfile("agent-1");
    const updated = updateProfile(profile, BASE_OUTCOME, "code");
    expect(updated.byTaskType["code"]?.successRate).toBe(1);
  });

  it("sets successRate to 0 after a single failure", () => {
    const profile = createEmptyProfile("agent-1");
    const fail = { ...BASE_OUTCOME, succeeded: false };
    const updated = updateProfile(profile, fail, "code");
    expect(updated.byTaskType["code"]?.successRate).toBe(0);
  });

  it("converges rolling average over 2 successes + 1 failure", () => {
    let profile = createEmptyProfile("agent-1");
    profile = updateProfile(profile, { ...BASE_OUTCOME, succeeded: true }, "code");
    profile = updateProfile(profile, { ...BASE_OUTCOME, succeeded: true }, "code");
    profile = updateProfile(profile, { ...BASE_OUTCOME, succeeded: false }, "code");
    // after 1: rollingAvg(0, 1, 1) = 1
    // after 2: rollingAvg(1, 1, 2) = 1
    // after 3: rollingAvg(1, 0, 3) = 2/3
    expect(profile.byTaskType["code"]?.successRate).toBeCloseTo(2 / 3, 5);
  });

  it("accumulates overall stats across multiple task types", () => {
    let profile = createEmptyProfile("agent-1");
    profile = updateProfile(profile, BASE_OUTCOME, "code");
    profile = updateProfile(profile, BASE_OUTCOME, "reasoning");
    expect(profile.overall.totalCases).toBe(2);
  });

  it("weights overall successRate by task type case count", () => {
    let profile = createEmptyProfile("agent-1");
    // 2 code successes, 1 reasoning failure
    profile = updateProfile(profile, { ...BASE_OUTCOME, succeeded: true }, "code");
    profile = updateProfile(profile, { ...BASE_OUTCOME, succeeded: true }, "code");
    profile = updateProfile(profile, { ...BASE_OUTCOME, succeeded: false }, "reasoning");
    // code: 2 cases, successRate=1 → contributes 2
    // reasoning: 1 case, successRate=0 → contributes 0
    // overall: (2*1 + 1*0) / 3 = 2/3
    expect(profile.overall.successRate).toBeCloseTo(2 / 3, 5);
  });

  it("marks a task type as a strength after 3 high-success cases", () => {
    let profile = createEmptyProfile("agent-1");
    for (let i = 0; i < 3; i++) {
      profile = updateProfile(profile, { ...BASE_OUTCOME, succeeded: true }, "code");
    }
    expect(profile.strengths).toContain("code");
  });

  it("does NOT mark a strength with only 2 cases", () => {
    let profile = createEmptyProfile("agent-1");
    for (let i = 0; i < 2; i++) {
      profile = updateProfile(profile, { ...BASE_OUTCOME, succeeded: true }, "code");
    }
    expect(profile.strengths).not.toContain("code");
  });

  it("marks a task type as a weakness after 3 low-success cases", () => {
    let profile = createEmptyProfile("agent-1");
    for (let i = 0; i < 3; i++) {
      profile = updateProfile(profile, { ...BASE_OUTCOME, succeeded: false }, "code");
    }
    expect(profile.weaknesses).toContain("code");
  });

  it("does NOT mark a weakness with only 2 cases", () => {
    let profile = createEmptyProfile("agent-1");
    for (let i = 0; i < 2; i++) {
      profile = updateProfile(profile, { ...BASE_OUTCOME, succeeded: false }, "code");
    }
    expect(profile.weaknesses).not.toContain("code");
  });

  it("records high reliance when hint is explicitly referenced", () => {
    const profile = createEmptyProfile("agent-1");
    const referenced = { ...BASE_OUTCOME, hintReferenced: true };
    const updated = updateProfile(profile, referenced, "code");
    // rollingAvg(0, 1.0, 1) = 1.0
    expect(updated.byTaskType["code"]?.averageReliance).toBe(1.0);
  });

  it("records low reliance when hint is not referenced", () => {
    const profile = createEmptyProfile("agent-1");
    const updated = updateProfile(profile, { ...BASE_OUTCOME, hintReferenced: false }, "code");
    // rollingAvg(0, 0.2, 1) = 0.2
    expect(updated.byTaskType["code"]?.averageReliance).toBeCloseTo(0.2, 5);
  });

  it("updates the lastUpdated timestamp", () => {
    const before = new Date(Date.now() - 1000);
    const profile = createEmptyProfile("agent-1");
    const updated = updateProfile(profile, BASE_OUTCOME, "code");
    expect(updated.lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it("accumulates attempts-to-success in the rolling average", () => {
    const profile = createEmptyProfile("agent-1");
    const outcome = { ...BASE_OUTCOME, attemptsAfterHint: 3 };
    const updated = updateProfile(profile, outcome, "code");
    // averageAttemptsToSuccess = rollingAvg(0, 3+1, 1) = 4
    expect(updated.byTaskType["code"]?.averageAttemptsToSuccess).toBe(4);
  });

  it("does not mutate the original profile", () => {
    const profile = createEmptyProfile("agent-1");
    const originalCases = profile.overall.totalCases;
    updateProfile(profile, BASE_OUTCOME, "code");
    expect(profile.overall.totalCases).toBe(originalCases);
  });
});
