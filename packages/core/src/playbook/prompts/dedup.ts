import type { PlaybookBullet } from "../bullet.js";

export const DEDUP_SYSTEM = `You compare two playbook lessons for redundancy.

Two bullets are redundant if they teach the same actionable pattern — wording differences alone do not matter.

Respond with JSON only:
{
  "redundant": boolean,
  "keepId": string | null,
  "dropId": string | null
}

When redundant is true, keepId must be the bullet id to retain (prefer the one with clearer wording), and dropId the one to remove.
When redundant is false, keepId and dropId must be null.`;

export function buildDedupUserMessage(a: PlaybookBullet, b: PlaybookBullet): string {
  return `## Bullet A (${a.id})
category: ${a.category}
taskTypes: ${a.taskTypes.join(", ")}
targetConcept: ${a.targetConcept}
net score (helpful - harmful): ${a.helpfulCount - a.harmfulCount}
${a.content}

## Bullet B (${b.id})
category: ${b.category}
taskTypes: ${b.taskTypes.join(", ")}
targetConcept: ${b.targetConcept}
net score (helpful - harmful): ${b.helpfulCount - b.harmfulCount}
${b.content}`;
}
