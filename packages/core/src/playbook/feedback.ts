import type { HintOutcome } from "../models/outcome.js";
import type { RelianceScore } from "../models/reliance.js";

export type BulletFeedback = "helpful" | "harmful" | "neutral";

/**
 * Maps outcome + optional reliance to per-bullet ACE-style feedback.
 */
export function bulletFeedbackFromOutcome(
  outcome: HintOutcome,
  reliance: RelianceScore | undefined
): BulletFeedback {
  if (!reliance) {
    return outcome.succeeded ? "neutral" : "harmful";
  }
  if (!outcome.succeeded) {
    return "harmful";
  }
  if (reliance.assessment === "high") {
    return "harmful";
  }
  if (reliance.assessment === "low") {
    return "helpful";
  }
  return "neutral";
}
