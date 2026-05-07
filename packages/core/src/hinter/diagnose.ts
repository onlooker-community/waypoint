import { extractTag, parseEnum } from "../utils/xml.js";
import type {
  Diagnosis,
  FailureType,
  HintDirection,
} from "./prompts/diagnose.js";

const FAILURE_TYPES: readonly FailureType[] = [
  "wrong_approach",
  "missing_concept",
  "implementation_error",
  "misunderstood_task",
  "out_of_scope",
];

const HINT_DIRECTIONS: readonly HintDirection[] = [
  "reframe",
  "missing_tool",
  "intermediate_goal",
  "alternative_representation",
  "constraint_reminder",
];

export function parseDiagnosis(raw: string): Diagnosis {
  const failureType = parseEnum(
    extractTag(raw, "failure_type"),
    FAILURE_TYPES
  );
  const rootCause = extractTag(raw, "root_cause");
  const missingInsight = extractTag(raw, "missing_insight");
  const hintDirection = parseEnum(
    extractTag(raw, "hint_direction"),
    HINT_DIRECTIONS
  );

  // Fall back gracefully — a partial diagnosis is still useful
  return {
    failureType: failureType ?? "wrong_approach",
    rootCause: rootCause ?? "Unknown failure mode",
    missingInsight: missingInsight ?? "Unknown",
    hintDirection: hintDirection ?? "reframe",
  };
}