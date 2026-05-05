import { describe, it, expect } from "vitest";
import { buildDiagnosePrompt } from "./diagnose.js";
import { buildGeneratePrompt } from "./generate.js";
import { buildDifficultyPrompt } from "./difficulty.js";
import { buildJudgePrompt } from "./judge.js";
import type { WaypointCase } from "../../models/case.js";
import type { Diagnosis } from "./diagnose.js";

const SAMPLE_CASE: WaypointCase = {
  id: "test-case-1",
  task: {
    content: "Write a function that finds all prime numbers up to n",
    type: "code",
    successCriteria: "Must use the Sieve of Eratosthenes, not trial division",
    context: "JavaScript environment, Node.js 20",
  },
  attempt: {
    content: "function primes(n) { /* trial division O(n^2) */ }",
    failureSignal: "Uses O(n²) trial division instead of sieve",
    attemptNumber: 1,
    timestamp: new Date("2024-01-01"),
  },
};

const SAMPLE_DIAGNOSIS: Diagnosis = {
  failureType: "wrong_approach",
  rootCause: "Agent used trial division",
  missingInsight: "Sieve of Eratosthenes",
  hintDirection: "missing_tool",
};

describe("buildDiagnosePrompt", () => {
  it("matches diagnose prompt snapshot", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toMatchSnapshot();
  });

  it("includes the task type", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toContain("code");
  });

  it("includes the task content", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toContain("prime numbers up to n");
  });

  it("includes the failure signal", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toContain("trial division");
  });

  it("includes the attempt number", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toContain("Attempt #1");
  });

  it("includes the agent's attempt content", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toContain("trial division O(n^2)");
  });

  it("includes all required failure_type enum values", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toContain("wrong_approach");
    expect(prompt).toContain("missing_concept");
    expect(prompt).toContain("implementation_error");
    expect(prompt).toContain("misunderstood_task");
    expect(prompt).toContain("out_of_scope");
  });

  it("includes all required hint_direction enum values", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toContain("reframe");
    expect(prompt).toContain("missing_tool");
    expect(prompt).toContain("intermediate_goal");
    expect(prompt).toContain("alternative_representation");
    expect(prompt).toContain("constraint_reminder");
  });

  it("includes the XML output format structure", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toContain("<diagnosis>");
    expect(prompt).toContain("<failure_type>");
    expect(prompt).toContain("<root_cause>");
    expect(prompt).toContain("<hint_direction>");
  });

  it("includes context when provided", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toContain("JavaScript environment");
  });

  it("omits the context section when not provided", () => {
    const noCtx: WaypointCase = {
      ...SAMPLE_CASE,
      task: { ...SAMPLE_CASE.task, context: undefined },
    };
    const prompt = buildDiagnosePrompt(noCtx);
    expect(prompt).not.toContain("JavaScript environment");
  });

  it("includes success criteria for analyst reference", () => {
    const prompt = buildDiagnosePrompt(SAMPLE_CASE);
    expect(prompt).toContain("Sieve of Eratosthenes");
  });
});

describe("buildGeneratePrompt", () => {
  it("matches generate prompt snapshot", () => {
    const prompt = buildGeneratePrompt(SAMPLE_CASE, SAMPLE_DIAGNOSIS);
    expect(prompt).toMatchSnapshot();
  });

  it("includes the task content", () => {
    const prompt = buildGeneratePrompt(SAMPLE_CASE, SAMPLE_DIAGNOSIS);
    expect(prompt).toContain("prime numbers up to n");
  });

  it("includes diagnosis failure type", () => {
    const prompt = buildGeneratePrompt(SAMPLE_CASE, SAMPLE_DIAGNOSIS);
    expect(prompt).toContain("wrong_approach");
  });

  it("includes diagnosis root cause", () => {
    const prompt = buildGeneratePrompt(SAMPLE_CASE, SAMPLE_DIAGNOSIS);
    expect(prompt).toContain("Agent used trial division");
  });

  it("includes the XML output format", () => {
    const prompt = buildGeneratePrompt(SAMPLE_CASE, SAMPLE_DIAGNOSIS);
    expect(prompt).toContain("<hint_output>");
    expect(prompt).toContain("<hint>");
    expect(prompt).toContain("<target_concept>");
  });

  it("marks success criteria as reference-only and instructs not to reveal", () => {
    const prompt = buildGeneratePrompt(SAMPLE_CASE, SAMPLE_DIAGNOSIS);
    expect(prompt).toContain("do not reveal");
    expect(prompt).toContain("Sieve of Eratosthenes");
  });

  it("enforces the 3-sentence limit rule", () => {
    const prompt = buildGeneratePrompt(SAMPLE_CASE, SAMPLE_DIAGNOSIS);
    expect(prompt).toContain("3 sentences");
  });

  it("includes a rule prohibiting meta-framing", () => {
    const prompt = buildGeneratePrompt(SAMPLE_CASE, SAMPLE_DIAGNOSIS);
    expect(prompt).toContain("Here is a hint");
  });

  it("includes hint direction guidance for missing_tool", () => {
    const prompt = buildGeneratePrompt(SAMPLE_CASE, SAMPLE_DIAGNOSIS);
    // The missing_tool guidance mentions naming the technique
    expect(prompt).toContain("algorithm");
  });

  it("omits context section when not provided", () => {
    const noCtx: WaypointCase = {
      ...SAMPLE_CASE,
      task: { ...SAMPLE_CASE.task, context: undefined },
    };
    const prompt = buildGeneratePrompt(noCtx, SAMPLE_DIAGNOSIS);
    expect(prompt).not.toContain("JavaScript environment");
  });

  it("produces different guidance for each hint direction", () => {
    const directions = [
      "reframe",
      "missing_tool",
      "intermediate_goal",
      "alternative_representation",
      "constraint_reminder",
    ] as const;

    const prompts = directions.map((dir) =>
      buildGeneratePrompt(SAMPLE_CASE, { ...SAMPLE_DIAGNOSIS, hintDirection: dir })
    );

    // All direction-specific sections should be distinct
    const uniquePrompts = new Set(prompts);
    expect(uniquePrompts.size).toBe(directions.length);
  });
});

describe("buildDifficultyPrompt", () => {
  it("matches difficulty prompt snapshot", () => {
    const prompt = buildDifficultyPrompt(SAMPLE_CASE.task, 2);
    expect(prompt).toMatchSnapshot();
  });

  it("includes the task content", () => {
    const prompt = buildDifficultyPrompt(SAMPLE_CASE.task);
    expect(prompt).toContain("prime numbers up to n");
  });

  it("shows 0 previous attempts by default", () => {
    const prompt = buildDifficultyPrompt(SAMPLE_CASE.task);
    expect(prompt).toContain("Previous failed attempts: 0");
  });

  it("includes the provided previous-attempt count", () => {
    const prompt = buildDifficultyPrompt(SAMPLE_CASE.task, 3);
    expect(prompt).toContain("3");
  });

  it("includes all four difficulty levels", () => {
    const prompt = buildDifficultyPrompt(SAMPLE_CASE.task);
    expect(prompt).toContain("easy");
    expect(prompt).toContain("medium");
    expect(prompt).toContain("hard");
    expect(prompt).toContain("out_of_scope");
  });

  it("includes the XML output format structure", () => {
    const prompt = buildDifficultyPrompt(SAMPLE_CASE.task);
    expect(prompt).toContain("<difficulty_assessment>");
    expect(prompt).toContain("<level>");
    expect(prompt).toContain("<score>");
    expect(prompt).toContain("<should_hint>");
  });

  it("includes success criteria when provided", () => {
    const prompt = buildDifficultyPrompt(SAMPLE_CASE.task);
    expect(prompt).toContain("Sieve of Eratosthenes");
  });

  it("omits success criteria section when not provided", () => {
    const noSc = { ...SAMPLE_CASE.task, successCriteria: undefined };
    const prompt = buildDifficultyPrompt(noSc);
    expect(prompt).not.toContain("Sieve of Eratosthenes");
  });
});

describe("buildJudgePrompt", () => {
  it("matches judge prompt snapshot", () => {
    const prompt = buildJudgePrompt("find primes", "think about sieves", "here is my sieve");
    expect(prompt).toMatchSnapshot();
  });

  it("includes the task", () => {
    const prompt = buildJudgePrompt("find primes", "think about sieves", "here is my sieve");
    expect(prompt).toContain("find primes");
  });

  it("includes the hint", () => {
    const prompt = buildJudgePrompt("find primes", "think about sieves", "here is my sieve");
    expect(prompt).toContain("think about sieves");
  });

  it("includes the agent output", () => {
    const prompt = buildJudgePrompt("find primes", "think about sieves", "here is my sieve");
    expect(prompt).toContain("here is my sieve");
  });

  it("includes the scoring scale anchors (0.0 and 1.0)", () => {
    const prompt = buildJudgePrompt("t", "h", "o");
    expect(prompt).toContain("0.0");
    expect(prompt).toContain("1.0");
  });

  it("includes the XML output format structure", () => {
    const prompt = buildJudgePrompt("t", "h", "o");
    expect(prompt).toContain("<reliance_assessment>");
    expect(prompt).toContain("<score>");
    expect(prompt).toContain("<hint_explicitly_referenced>");
    expect(prompt).toContain("<reasoning>");
  });
});
