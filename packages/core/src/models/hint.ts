import { z } from "zod";

// How the hint should be surfaced in the tool
// Adapters use this to format output correctly for their environment
export const DeliveryModeSchema = z.enum([
  "append",   // append to end of prompt — default, lowest reliance risk
  "comment",  // inline code comment — cursor-style tools
  "inline",   // injected at cursor position
  "aside",    // shown as a sidebar/panel — doesn't touch the prompt at all
]);

export type DeliveryMode = z.infer<typeof DeliveryModeSchema>;

export const HintRecommendationSchema = z.enum([
  "hint",      // proceed with hinting
  "escalate",  // too hard, surface to human
  "skip",      // too easy, no hint needed — shouldn't have been called
]);

export type HintRecommendation = z.infer<typeof HintRecommendationSchema>;

export const HintQualitySchema = z.object({
  // Estimated probability this hint produces a non-degenerate group
  // i.e. does it actually unblock the reasoner at all
  // Maps to s(p_hat; G) in the HiLL paper
  signalCreation: z.number().min(0).max(1),

  // Estimated probability hinted success transfers to no-hint success
  // Maps to exp(-rho_c) in the HiLL paper
  signalTransfer: z.number().min(0).max(1),

  // How confident Waypoint is in its own quality estimates
  confidence: z.number().min(0).max(1),
});

export type HintQuality = z.infer<typeof HintQualitySchema>;

export const WaypointHintSchema = z.object({
  id: z.string().min(1),

  // The hint itself — should be 1-3 sentences, conceptual, no solution steps
  content: z.string().min(1),

  // Which case this hint is for
  caseId: z.string().min(1),

  deliveryMode: DeliveryModeSchema.default("append"),

  quality: HintQualitySchema,

  // What concept or insight the hint is targeting
  // e.g. "parameterization", "law of cosines", "off-by-one indexing"
  // Useful for logging, learning, and UI
  targetConcept: z.string(),

  recommendation: HintRecommendationSchema,

  createdAt: z.date().default(() => new Date()),
});

export type WaypointHint = z.infer<typeof WaypointHintSchema>;