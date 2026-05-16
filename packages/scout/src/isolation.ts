import type { Branch, ContextUnit, MainlineState } from "./types.js";

// Find a branch by id, returning undefined when nothing matches.
// Kept private — callers should go through getActiveContext et al.
function findBranch(
  state: MainlineState,
  branchId: string
): Branch | undefined {
  return state.branches.find((b) => b.id === branchId);
}

// Locate the index of the anchor node within the mainline. Returns -1 when
// the anchor is missing, which the callers treat as "no mainline prefix".
function anchorIndex(state: MainlineState, anchorNodeId: string): number {
  return state.nodes.findIndex((n) => n.id === anchorNodeId);
}

// Resolve the active context for model inference.
//
// Mainline mode (no currentBranchId): every active mainline node from the
// start of the conversation up to and including the current position. The
// ticket does not pin down what "current position" means, so we model it as
// "the last node in state.nodes" — i.e. the most recently appended turn.
// startNodeId/endNodeId are kept on the state for future use (e.g. windowed
// playback) but do not constrain this default.
//
// Branch mode: the mainline prefix up to and including the anchor (filtered
// by activationState === "active"), followed by the branch's own nodes
// (also filtered). Sibling branches are deliberately excluded — that is the
// core isolation guarantee.
//
// An unknown branchId returns an empty array rather than falling back to
// the mainline, so the caller notices the mistake instead of silently
// leaking sibling context.
export function getActiveContext(
  state: MainlineState,
  currentBranchId?: string
): ContextUnit[] {
  if (currentBranchId === undefined) {
    return state.nodes.filter((n) => n.activationState === "active");
  }

  const branch = findBranch(state, currentBranchId);
  if (!branch) {
    return [];
  }

  const idx = anchorIndex(state, branch.anchorNodeId);
  const prefix =
    idx === -1
      ? []
      : state.nodes.slice(0, idx + 1).filter((n) => n.activationState === "active");

  const branchActive = branch.nodes.filter(
    (n) => n.activationState === "active"
  );

  return [...prefix, ...branchActive];
}

// Toggle a unit's activation without removing it from the state. We search
// the mainline first, then every branch. The whole state is rebuilt
// immutably so callers can rely on referential equality elsewhere.
function setActivation(
  state: MainlineState,
  unitId: string,
  next: ContextUnit["activationState"]
): MainlineState {
  let touched = false;

  const nodes = state.nodes.map((n) => {
    if (n.id === unitId) {
      touched = true;
      return { ...n, activationState: next };
    }
    return n;
  });

  const branches = state.branches.map((b) => {
    let branchTouched = false;
    const branchNodes = b.nodes.map((n) => {
      if (n.id === unitId) {
        branchTouched = true;
        touched = true;
        return { ...n, activationState: next };
      }
      return n;
    });
    return branchTouched ? { ...b, nodes: branchNodes } : b;
  });

  if (!touched) {
    return state;
  }

  return { ...state, nodes, branches };
}

// Mark a unit active. No-op (returns the same reference) when the unit
// cannot be found anywhere in the state.
export function includeUnit(
  state: MainlineState,
  unitId: string
): MainlineState {
  return setActivation(state, unitId, "active");
}

// Mark a unit inactive without deleting it. "inactive" is the soft-park
// state — the unit is still in the structure and can be re-included later.
// We deliberately don't move to "parked", which is reserved for the Memory
// Agent's explicit parking flow.
export function excludeUnit(
  state: MainlineState,
  unitId: string
): MainlineState {
  return setActivation(state, unitId, "inactive");
}
