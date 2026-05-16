export {
  ContextUnitSchema,
  BranchSchema,
  MainlineStateSchema,
} from "./types.js";
export type { ContextUnit, Branch, MainlineState } from "./types.js";

export { getActiveContext, includeUnit, excludeUnit } from "./isolation.js";
