import { extractTag } from "../utils/xml.js";
import type { WaypointCase } from "../models/case.js";
import type { WaypointHint } from "../models/hint.js";
import type { Diagnosis } from "./prompts/diagnose.js";
import { buildGeneratePrompt } from "./prompts/generate.js";

export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
}

export interface RawHintOutput {
  targetConcept: string;
  content: string;
}

/**
 * Call the LLM to generate a hint from a diagnosis.
 * Returns the raw parsed output — scoring happens separately.
 */
export async function generateHint(
  waypointCase: WaypointCase,
  diagnosis: Diagnosis,
  options: GenerateOptions = {}
): Promise<RawHintOutput> {
  const { model = "claude-sonnet-4-20250514", maxTokens = 512 } = options;

  const prompt = buildGeneratePrompt(waypointCase, diagnosis);

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

  return parseHintOutput(raw);
}

function parseHintOutput(raw: string): RawHintOutput {
  const targetConcept = extractTag(raw, "target_concept");
  const hint = extractTag(raw, "hint");

  // If parsing fails, use the raw text as the hint
  // Better to deliver something than fail silently
  return {
    targetConcept: targetConcept ?? "general approach",
    content: hint ?? raw.trim(),
  };
}

function getApiKey(): string {
  const key =
    typeof process !== "undefined"
      ? process.env["ANTHROPIC_API_KEY"]
      : undefined;

  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is not set. " +
        "Set it before using Waypoint."
    );
  }

  return key;
}

function extractTextContent(response: AnthropicResponse): string {
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// Minimal Anthropic response types — just what we need
interface AnthropicResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}