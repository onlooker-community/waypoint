import { extractTag, parseFloat01, parseBool } from "../utils/xml.js";
import { buildJudgePrompt } from "../hinter/prompts/judge.js";
import type { RelianceScore } from "../models/reliance.js";

export interface JudgeOptions {
  model?: string;
  maxTokens?: number;
}

export async function judgeReliance(
  task: string,
  hint: string,
  output: string,
  options: JudgeOptions = {}
): Promise<RelianceScore> {
  const { model = "claude-sonnet-4-20250514", maxTokens = 256 } = options;

  const prompt = buildJudgePrompt(task, hint, output);

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

  return parseJudgeOutput(raw);
}

function parseJudgeOutput(raw: string): RelianceScore {
  const scoreRaw = extractTag(raw, "score");
  const referencedRaw = extractTag(raw, "hint_explicitly_referenced");
  const reasoningRaw = extractTag(raw, "reasoning");

  const score = parseFloat01(scoreRaw) ?? 0.5;
  const hintExplicitlyReferenced = parseBool(referencedRaw) ?? false;
  const reasoning = reasoningRaw ?? "Unable to parse judge reasoning";

  // Bump score if hint was explicitly referenced — it's a strong signal
  const adjustedScore = hintExplicitlyReferenced
    ? Math.max(score, 0.6)
    : score;

  return {
    score: adjustedScore,
    assessment: scoreToAssessment(adjustedScore),
    method: "judge",
    reasoning,
    hintExplicitlyReferenced,
  };
}

function scoreToAssessment(
  score: number
): RelianceScore["assessment"] {
  if (score < 0.35) return "low";
  if (score < 0.65) return "medium";
  return "high";
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