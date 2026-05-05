import { describe, it, expect } from "vitest";
import { parseDiagnosis } from "./diagnose.js";

const WELL_FORMED = `
<diagnosis>
  <failure_type>wrong_approach</failure_type>
  <root_cause>Agent used trial division instead of a sieve algorithm</root_cause>
  <missing_insight>Sieve of Eratosthenes algorithm</missing_insight>
  <hint_direction>missing_tool</hint_direction>
</diagnosis>
`.trim();

describe("parseDiagnosis", () => {
  it("parses a well-formed diagnosis", () => {
    const result = parseDiagnosis(WELL_FORMED);
    expect(result.failureType).toBe("wrong_approach");
    expect(result.rootCause).toBe("Agent used trial division instead of a sieve algorithm");
    expect(result.missingInsight).toBe("Sieve of Eratosthenes algorithm");
    expect(result.hintDirection).toBe("missing_tool");
  });

  it("handles all valid failure types", () => {
    const types = [
      "wrong_approach",
      "missing_concept",
      "implementation_error",
      "misunderstood_task",
      "out_of_scope",
    ] as const;

    for (const type of types) {
      const xml = [
        "<diagnosis>",
        `  <failure_type>${type}</failure_type>`,
        "  <root_cause>r</root_cause>",
        "  <missing_insight>m</missing_insight>",
        "  <hint_direction>reframe</hint_direction>",
        "</diagnosis>",
      ].join("\n");
      expect(parseDiagnosis(xml).failureType).toBe(type);
    }
  });

  it("handles all valid hint directions", () => {
    const directions = [
      "reframe",
      "missing_tool",
      "intermediate_goal",
      "alternative_representation",
      "constraint_reminder",
    ] as const;

    for (const dir of directions) {
      const xml = [
        "<diagnosis>",
        "  <failure_type>wrong_approach</failure_type>",
        "  <root_cause>r</root_cause>",
        "  <missing_insight>m</missing_insight>",
        `  <hint_direction>${dir}</hint_direction>`,
        "</diagnosis>",
      ].join("\n");
      expect(parseDiagnosis(xml).hintDirection).toBe(dir);
    }
  });

  it("falls back gracefully on empty input", () => {
    const result = parseDiagnosis("");
    expect(result.failureType).toBe("wrong_approach");
    expect(result.rootCause).toBe("Unknown failure mode");
    expect(result.missingInsight).toBe("Unknown");
    expect(result.hintDirection).toBe("reframe");
  });

  it("falls back to defaults when failure_type is an invalid enum value", () => {
    const xml = "<diagnosis><failure_type>totally_wrong</failure_type></diagnosis>";
    const result = parseDiagnosis(xml);
    expect(result.failureType).toBe("wrong_approach");
  });

  it("falls back when hint_direction is an invalid enum value", () => {
    const xml = [
      "<diagnosis>",
      "  <failure_type>wrong_approach</failure_type>",
      "  <root_cause>r</root_cause>",
      "  <missing_insight>m</missing_insight>",
      "  <hint_direction>invalid_direction</hint_direction>",
      "</diagnosis>",
    ].join("\n");
    const result = parseDiagnosis(xml);
    expect(result.hintDirection).toBe("reframe");
  });

  it("handles a partial response with only failure_type present", () => {
    const xml = "<diagnosis><failure_type>missing_concept</failure_type></diagnosis>";
    const result = parseDiagnosis(xml);
    expect(result.failureType).toBe("missing_concept");
    expect(result.rootCause).toBe("Unknown failure mode");
    expect(result.missingInsight).toBe("Unknown");
    expect(result.hintDirection).toBe("reframe");
  });

  it("parses out_of_scope correctly", () => {
    const xml = [
      "<diagnosis>",
      "  <failure_type>out_of_scope</failure_type>",
      "  <root_cause>Task requires human judgment</root_cause>",
      "  <missing_insight>N/A</missing_insight>",
      "  <hint_direction>reframe</hint_direction>",
      "</diagnosis>",
    ].join("\n");
    const result = parseDiagnosis(xml);
    expect(result.failureType).toBe("out_of_scope");
    expect(result.rootCause).toBe("Task requires human judgment");
  });

  it("handles LLM preamble text before the XML block", () => {
    const withPreamble = `Here is my careful analysis:\n\n${WELL_FORMED}\n\nI hope this helps!`;
    const result = parseDiagnosis(withPreamble);
    expect(result.failureType).toBe("wrong_approach");
    expect(result.rootCause).toBe("Agent used trial division instead of a sieve algorithm");
    expect(result.hintDirection).toBe("missing_tool");
  });

  it("handles whitespace-padded tag values", () => {
    const xml = [
      "<diagnosis>",
      "  <failure_type>  implementation_error  </failure_type>",
      "  <root_cause>Off-by-one error</root_cause>",
      "  <missing_insight>Boundary condition</missing_insight>",
      "  <hint_direction>  constraint_reminder  </hint_direction>",
      "</diagnosis>",
    ].join("\n");
    const result = parseDiagnosis(xml);
    expect(result.failureType).toBe("implementation_error");
    expect(result.hintDirection).toBe("constraint_reminder");
  });
});
