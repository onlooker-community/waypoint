import { extractTag } from "../utils/xml.js";
import type { WaypointCase } from "../models/case.js";
import type { WaypointHint } from "../models/hint.js";
import { buildDiagnosePrompt } from "./prompts/diagnose.js";
import { parseDiagnosis } from "./diagnose.js";
import { generateHint } from "./generate.js";

export interface HinterOptions {
  model?: string;
  maxTokens?: number;
}

export async function runHinter(
  waypointCase: WaypointCase,
  options: HinterOptions = {}
): Promise<WaypointHint> {
  const { model = "claude-sonnet-4-20250514" } = options;

  // Step 1: Diagnose the failure
  const diagnosisRaw = await callLLM(
    buildDiagnosePrompt(waypointCase),
    model,
    256
  );
  const diagnosis = parseDiagnosis(diagnosisRaw);

  // Step 2: Check if out_of_scope — escalate immediately
  if (diagnosis.failureType === "out_of_scope") {
    return buildHint(waypointCase.id, {
      content: "",
      targetConcept: "out_of_scope",
      recommendation: "escalate",
      signalCreation: 0,
      signalTransfer: 0,
      confidence: 0.9,
    });
  }

  // Step 3: Generate the hint
  const rawHint = await generateHint(waypointCase, diagnosis, options);

  // Step 4: Score signal creation
  // We estimate based on diagnosis confidence — real signal creation
  // scoring happens after the reasoner re-samples (in the API layer)
  const signalCreation = estimateSignalCreation(diagnosis);
  const signalTransfer = estimateSignalTransfer(diagnosis);

  return buildHint(waypointCase.id, {
    content: rawHint.content,
    targetConcept: rawHint.targetConcept,
    recommendation: "hint",
    signalCreation,
    signalTransfer,
    confidence: 0.7, // Pre-outcome confidence — updated after recordOutcome
  });
}

function buildHint(
  caseId: string,
  params: {
    content: string;
    targetConcept: string;
    recommendation: WaypointHint["recommendation"];
    signalCreation: number;
    signalTransfer: number;
    confidence: number;
  }
): WaypointHint {
  return {
    id: crypto.randomUUID(),
    caseId,
    content: params.content,
    deliveryMode: "append",
    targetConcept: params.targetConcept,
    recommendation: params.recommendation,
    quality: {
      signalCreation: params.signalCreation,
      signalTransfer: params.signalTransfer,
      confidence: params.confidence,
    },
    // runHinter doesn't read from the playbook (only the deps-injected
    // WaypointCore in api/waypoint.ts does); always emit an empty list so
    // downstream consumers don't need to nullish-check it.
    playbookBulletIds: [],
    createdAt: new Date(),
  };
}

// Heuristic pre-outcome estimates based on diagnosis type
// These get refined once outcomes are recorded
function estimateSignalCreation(
  diagnosis: ReturnType<typeof parseDiagnosis>
): number {
  switch (diagnosis.failureType) {
    case "missing_concept": return 0.7;
    case "wrong_approach": return 0.65;
    case "misunderstood_task": return 0.6;
    case "implementation_error": return 0.5;
    case "out_of_scope": return 0.1;
    default: return 0.5;
  }
}

function estimateSignalTransfer(
  diagnosis: ReturnType<typeof parseDiagnosis>
): number {
  switch (diagnosis.hintDirection) {
    case "reframe": return 0.85;
    case "missing_tool": return 0.8;
    case "intermediate_goal": return 0.75;
    case "alternative_representation": return 0.7;
    case "constraint_reminder": return 0.65;
    default: return 0.7;
  }
}

async function callLLM(
  prompt: string,
  model: string,
  maxTokens: number
): Promise<string> {
  const key =
    typeof process !== "undefined"
      ? process.env["ANTHROPIC_API_KEY"]
      : undefined;
  if (!key) throw new Error("ANTHROPIC_API_KEY environment variable is not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  return data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
