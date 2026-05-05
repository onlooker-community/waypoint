import type { WaypointCase } from "../models/case.js";
import type { WaypointHint } from "../models/hint.js";
import type { HintOutcome } from "../models/outcome.js";

// Which model provider is doing the reasoning in this tool
// Waypoint uses this to adjust hint style and reliance measurement strategy
export interface ReasonerInfo {
  modelId: string;
  provider: "anthropic" | "openai" | "google" | "other";
  contextWindow: number;

  // If true, Waypoint can use log probability comparison for reliance
  // If false, falls back to judge model
  supportsLogProbs: boolean;
}

// Tool-specific context passed through to delivery
// Each adapter casts raw to its own internal type
export interface AdapterContext {
  raw: unknown;
  sessionId: string;
  agentId: string;
}

export interface WaypointAdapter {
  // Adapter identity — used for logging and routing decisions
  readonly id: string;
  readonly version: string;

  // Transform a tool-specific failure event into a WaypointCase
  // This is where each tool's idiosyncrasies get normalized away
  parseFailure(rawEvent: unknown): WaypointCase;

  // Deliver a hint back in the tool's native format
  // append → inject into prompt
  // comment → insert as code comment
  // inline → inject at cursor position
  // aside → show in sidebar without touching the prompt
  deliverHint(hint: WaypointHint, context: AdapterContext): Promise<void>;

  // Parse a tool-specific success/failure event into a HintOutcome
  // Called after the agent responds to the hint
  parseOutcome(rawEvent: unknown): HintOutcome;

  // Optional: tool-native log probability comparison
  // More accurate than the judge model fallback
  // Only implement if the tool/model exposes log probs
  measureReliance?: (
    task: string,
    hint: string,
    output: string
  ) => Promise<number>;

  // What model is doing the reasoning in this tool
  getReasonerInfo(): ReasonerInfo;
}