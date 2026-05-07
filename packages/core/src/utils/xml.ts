/**
 * Extract content from an XML-style tag in an LLM response.
 * LLMs sometimes add whitespace or wrap in markdown — this handles both.
 */
export function extractTag(xml: string, tag: string): string | null {
  // Match <tag>...</tag> with optional whitespace and multiline content
  const pattern = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, "i");
  const match = xml.match(pattern);
  if (!match) return null;

  return match[0]
    .replace(new RegExp(`^<${tag}>`, "i"), "")
    .replace(new RegExp(`<\\/${tag}>$`, "i"), "")
    .trim();
}

/**
 * Parse a float from a string, returning null if invalid or out of range.
 */
export function parseFloat01(value: string | null): number | null {
  if (!value) return null;
  const n = parseFloat(value);
  if (isNaN(n)) return null;
  return Math.max(0, Math.min(1, n));
}

/**
 * Parse a boolean from a string ("true" / "false").
 */
export function parseBool(value: string | null): boolean | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  if (lower === "true") return true;
  if (lower === "false") return false;
  return null;
}

/**
 * Assert a value is one of a set of string literals.
 * Returns null if not matched — callers decide how to handle.
 */
export function parseEnum<T extends string>(
  value: string | null,
  values: readonly T[]
): T | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim() as T;
  return values.includes(lower) ? lower : null;
}