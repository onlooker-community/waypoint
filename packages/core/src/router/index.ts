import { extractTag, parseFloat01, parseBool, parseEnum } from "../utils/xml.js";
import { buildDifficultyPrompt } from "../hinter/prompts/difficulty.js";
import type { Task } from "../models/task.js";
import type { DifficultyEstimate, DifficultyLevel } from "../models/difficulty.js";
import type { AgentCapabilityProfile } from "../models/profile.js";

const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = [
  "easy",
  "medium",
  "hard",
  "out_of_scope",
];

export interface RouterOptions {
  model?: string;
  maxTokens?: number;
}

export async function estimateDifficulty(
  task: Task,
  previousAttempts: number = 0,
  _agentProfile?: AgentCapabilityProfile,
  options: RouterOptions = {}
): Promise<DifficultyEstimate> {
  const { model = "claude-sonnet-4-20250514", maxTokens = 256 } = options;

  const prompt = buildDifficultyPrompt(task, previousAttempts);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const raw = extractTextContent(data);

  return parseDifficultyOutput(raw, task);
}

function parseDifficultyOutput(
  raw: string,
  task: Task
): DifficultyEstimate {
  const levelRaw = extractTag(raw, "level");
  const scoreRaw = extractTag(raw, "score");
  const shouldHintRaw = extractTag(raw, "should_hint");
  const reasoningRaw = extractTag(raw, "reasoning");

  const level = parseEnum(levelRaw, DIFFICULTY_LEVELS) ?? "medium";
  const score = parseFloat01(scoreRaw) ?? 0.5;
  const shouldHint = parseBool(shouldHintRaw) ?? level !== "easy";
  const reasoning = reasoningRaw ?? "Unable to parse difficulty assessment";

  return {
    level,
    score,
    reasoning,
    shouldHint,
    suggestedTaskType: task.type,
  };
}

function getApiKey(): string {
  const key =
    typeof process !== "undefined"
      ? process.env["ANTHROPIC_API_KEY"]
      : undefined;
  if (!key) throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  return key;
}

function extractTextContent(response: AnthropicResponse): string {
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}
