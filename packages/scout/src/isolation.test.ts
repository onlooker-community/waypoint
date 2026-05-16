import { describe, it, expect } from "vitest";
import {
  excludeUnit,
  getActiveContext,
  includeUnit,
} from "./isolation.js";
import type { Branch, ContextUnit, MainlineState } from "./types.js";

// Tiny helper to keep the fixtures readable. We default activationState to
// "active" because every test that doesn't care about activation wants the
// happy path.
function unit(
  id: string,
  overrides: Partial<ContextUnit> = {}
): ContextUnit {
  return {
    id,
    content: `content-${id}`,
    role: "user",
    activationState: "active",
    timestamp: new Date("2025-01-01T00:00:00Z"),
    sessionId: "session-1",
    ...overrides,
  };
}

function branch(
  id: string,
  anchorNodeId: string,
  nodes: ContextUnit[],
  overrides: Partial<Branch> = {}
): Branch {
  return {
    id,
    anchorNodeId,
    nodes,
    state: "active",
    ...overrides,
  };
}

describe("getActiveContext — mainline mode", () => {
  it("returns every active mainline node when no branch is selected", () => {
    const state: MainlineState = {
      nodes: [unit("m1"), unit("m2"), unit("m3")],
      branches: [],
    };

    const active = getActiveContext(state);

    expect(active.map((n) => n.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("skips inactive and parked nodes", () => {
    const state: MainlineState = {
      nodes: [
        unit("m1"),
        unit("m2", { activationState: "inactive" }),
        unit("m3", { activationState: "parked" }),
        unit("m4"),
      ],
      branches: [],
    };

    const active = getActiveContext(state);

    expect(active.map((n) => n.id)).toEqual(["m1", "m4"]);
  });

  it("returns an empty array when the mainline has no nodes", () => {
    const state: MainlineState = { nodes: [], branches: [] };

    expect(getActiveContext(state)).toEqual([]);
  });
});

describe("getActiveContext — branch mode", () => {
  it("includes mainline prefix up to anchor plus branch nodes", () => {
    const state: MainlineState = {
      nodes: [unit("m1"), unit("m2"), unit("m3"), unit("m4")],
      branches: [branch("b1", "m2", [unit("b1n1"), unit("b1n2")])],
    };

    const active = getActiveContext(state, "b1");

    // m3, m4 sit after the anchor — they belong to the post-fork future of
    // the mainline and must not leak into the branch's window.
    expect(active.map((n) => n.id)).toEqual(["m1", "m2", "b1n1", "b1n2"]);
  });

  it("excludes sibling branches entirely", () => {
    const state: MainlineState = {
      nodes: [unit("m1"), unit("m2")],
      branches: [
        branch("b1", "m1", [unit("b1n1"), unit("b1n2")]),
        branch("b2", "m1", [unit("b2n1"), unit("b2n2")]),
      ],
    };

    const fromB1 = getActiveContext(state, "b1");
    const fromB2 = getActiveContext(state, "b2");

    expect(fromB1.map((n) => n.id)).toEqual(["m1", "b1n1", "b1n2"]);
    expect(fromB2.map((n) => n.id)).toEqual(["m1", "b2n1", "b2n2"]);
    // No cross-contamination in either direction.
    expect(fromB1.some((n) => n.id.startsWith("b2"))).toBe(false);
    expect(fromB2.some((n) => n.id.startsWith("b1"))).toBe(false);
  });

  it("filters inactive units in the mainline prefix and inside the branch", () => {
    const state: MainlineState = {
      nodes: [
        unit("m1"),
        unit("m2", { activationState: "inactive" }),
        unit("m3"),
      ],
      branches: [
        branch("b1", "m3", [
          unit("b1n1"),
          unit("b1n2", { activationState: "parked" }),
          unit("b1n3"),
        ]),
      ],
    };

    const active = getActiveContext(state, "b1");

    expect(active.map((n) => n.id)).toEqual(["m1", "m3", "b1n1", "b1n3"]);
  });

  it("returns just the branch nodes when the anchor is unknown", () => {
    // Anchor missing from the mainline collapses the prefix to empty — we
    // still hand back the branch itself rather than silently failing.
    const state: MainlineState = {
      nodes: [unit("m1")],
      branches: [branch("b1", "ghost-anchor", [unit("b1n1")])],
    };

    expect(getActiveContext(state, "b1").map((n) => n.id)).toEqual(["b1n1"]);
  });

  it("returns just the mainline prefix when the branch has no nodes", () => {
    const state: MainlineState = {
      nodes: [unit("m1"), unit("m2"), unit("m3")],
      branches: [branch("b1", "m2", [])],
    };

    expect(getActiveContext(state, "b1").map((n) => n.id)).toEqual(["m1", "m2"]);
  });

  it("returns an empty array for an unknown branchId", () => {
    // Refusing to fall back to the mainline keeps caller bugs loud — a
    // typo'd branchId shouldn't quietly leak sibling context.
    const state: MainlineState = {
      nodes: [unit("m1"), unit("m2")],
      branches: [branch("b1", "m1", [unit("b1n1")])],
    };

    expect(getActiveContext(state, "does-not-exist")).toEqual([]);
  });
});

describe("includeUnit / excludeUnit", () => {
  it("flips an inactive mainline node back to active without deleting it", () => {
    const state: MainlineState = {
      nodes: [unit("m1", { activationState: "inactive" }), unit("m2")],
      branches: [],
    };

    const next = includeUnit(state, "m1");

    expect(next.nodes).toHaveLength(2);
    expect(next.nodes[0]?.activationState).toBe("active");
    expect(getActiveContext(next).map((n) => n.id)).toEqual(["m1", "m2"]);
  });

  it("excludes a mainline node by marking it inactive — node still present", () => {
    const state: MainlineState = {
      nodes: [unit("m1"), unit("m2")],
      branches: [],
    };

    const next = excludeUnit(state, "m1");

    // Same length: nothing was deleted, only deactivated.
    expect(next.nodes).toHaveLength(2);
    expect(next.nodes[0]?.activationState).toBe("inactive");
    expect(getActiveContext(next).map((n) => n.id)).toEqual(["m2"]);
  });

  it("toggles activation on units that live inside a branch", () => {
    const state: MainlineState = {
      nodes: [unit("m1")],
      branches: [
        branch("b1", "m1", [
          unit("b1n1"),
          unit("b1n2", { activationState: "inactive" }),
        ]),
      ],
    };

    const reincluded = includeUnit(state, "b1n2");
    const reincludedBranch = reincluded.branches[0];
    expect(reincludedBranch?.nodes[1]?.activationState).toBe("active");

    const excluded = excludeUnit(reincluded, "b1n1");
    const excludedBranch = excluded.branches[0];
    expect(excludedBranch?.nodes[0]?.activationState).toBe("inactive");
    expect(excludedBranch?.nodes).toHaveLength(2);
  });

  it("returns the same state reference when the unit is not found", () => {
    // Reference equality lets callers cheaply detect "no-op" updates.
    const state: MainlineState = {
      nodes: [unit("m1")],
      branches: [branch("b1", "m1", [unit("b1n1")])],
    };

    expect(includeUnit(state, "nope")).toBe(state);
    expect(excludeUnit(state, "nope")).toBe(state);
  });

  it("does not mutate the input state", () => {
    const original: MainlineState = {
      nodes: [unit("m1")],
      branches: [branch("b1", "m1", [unit("b1n1")])],
    };
    const snapshot = JSON.stringify(original);

    excludeUnit(original, "m1");
    includeUnit(original, "b1n1");

    expect(JSON.stringify(original)).toBe(snapshot);
  });
});
