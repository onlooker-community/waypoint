import type { PlaybookBullet } from "../bullet.js";

/**
 * Body lines for the generate prompt (category-prefixed, one per line).
 */
export function formatLessonLines(bullets: PlaybookBullet[]): string {
  return bullets
    .map((b) => `- [${b.category}] ${b.content}`)
    .join("\n");
}

/**
 * Full optional section for hint generation: lessons + usage constraints.
 */
export function formatPlaybookPromptSection(bullets: PlaybookBullet[]): string {
  if (bullets.length === 0) {
    return "";
  }
  const lines = formatLessonLines(bullets);
  return `## Relevant Lessons From Past Sessions
${lines}

These are generalizable lessons from previous failures and successes on similar tasks.
Use them to inform the hint direction, but do not reference them explicitly.`;
}
