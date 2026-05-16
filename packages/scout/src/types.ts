import { z } from "zod";

// A single turn in the conversation. ContextUnits are the atomic building
// blocks of every Scout state: mainline history and branch nodes are both
// just sequences of ContextUnit records.
//
// activationState is intentionally separate from "deletion": the Memory Agent
// (and the user) can park a unit out of the active window without losing it,
// which is the whole point of Scout's reversible isolation model.
export const ContextUnitSchema = z.object({
  id: z.string().min(1),
  content: z.string(),
  role: z.enum(["user", "assistant"]),
  activationState: z.enum(["active", "inactive", "parked"]),
  timestamp: z.date(),
  sessionId: z.string().min(1),
  annotations: z.array(z.string()).optional(),
});

export type ContextUnit = z.infer<typeof ContextUnitSchema>;

// A Branch is a divergent line of exploration anchored to a specific node in
// the mainline. Branch nodes live inside the branch and never bleed into the
// mainline unless explicitly promoted (out of scope for this ticket).
//
// "summary" is reserved for the Memory Agent's compressed description, used
// when reactivating a completed/abandoned branch without paying its full
// token cost.
export const BranchSchema = z.object({
  id: z.string().min(1),
  anchorNodeId: z.string().min(1),
  nodes: z.array(ContextUnitSchema),
  state: z.enum(["active", "completed", "abandoned"]),
  intent: z.string().optional(),
  summary: z.string().optional(),
});

export type Branch = z.infer<typeof BranchSchema>;

// MainlineState is the canonical conversation transcript plus all of its
// branches. Sibling branches coexist in this structure but are isolated by
// getActiveContext — they never appear in each other's active window.
export const MainlineStateSchema = z.object({
  nodes: z.array(ContextUnitSchema),
  startNodeId: z.string().min(1).optional(),
  endNodeId: z.string().min(1).optional(),
  branches: z.array(BranchSchema),
});

export type MainlineState = z.infer<typeof MainlineStateSchema>;
