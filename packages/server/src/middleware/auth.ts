import type { MiddlewareHandler } from "hono";

/**
 * Bearer-token auth middleware.
 */
export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const apiKey = process.env["WAYPOINT_API_KEY"];

  if (!apiKey) {
    return c.json({ error: "Server is misconfigured: WAYPOINT_API_KEY is not set" }, 500);
  }

  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ error: "Authorization header required" }, 401);
  }

  const token = header.slice(7);
  if (token !== apiKey) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  return next();
};
