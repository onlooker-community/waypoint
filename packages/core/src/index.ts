// Models — the data layer
export * from "./models/index.js";
export { Waypoint, createWaypoint } from "./api/index.js";

// API interface — what adapters depend on
export type { WaypointAPI } from "./api/types.js";

// Adapter interface — what tool integrations implement
export type { WaypointAdapter, AdapterContext, ReasonerInfo } from "./adapter/types.js";

// Store — persistence interface + in-memory default
export type { WaypointStore } from "./store/types.js";
export { MemoryStore } from "./store/memory.js";