import type { WaypointAPI } from "./types.js";
import type { WaypointStore } from "../store/types.js";
import type { WaypointCase } from "../models/case.js";
import {
  WaypointHintSchema,
  type DeliveryMode,
  type HintQuality,
  type HintRecommendation,
  type WaypointHint,
} from "../models/hint.js";
import type { HintOutcome } from "../models/outcome.js";
import {
  DifficultyEstimateSchema,
  type DifficultyEstimate,
} from "../models/difficulty.js";
import type { AgentCapabilityProfile } from "../models/profile.js";
import { createEmptyProfile } from "../models/profile.js";
import type { RelianceScore } from "../models/reliance.js";
import type { Task } from "../models/task.js";
import { bulletFeedbackFromOutcome } from "../playbook/feedback.js";
import { curateLesson } from "../playbook/curator.js";
import { deduplicateTaskTypeIfNeeded } from "../playbook/deduplicate.js";
import { formatPlaybookPromptSection } from "../playbook/prompts/hint-lessons.js";
import { getRelevantBullets } from "../playbook/retrieval.js";
import { judgeRelianceWithModel } from "./reliance-judge.js";
import { mergeOutcomeIntoProfile } from "./profile-merge.js";

export interface HintGenerationInput {
  waypointCase: WaypointCase;
  /** Full markdown section for the generate prompt (empty when no bullets). */
  playbookSection: string;
  /** IDs of bullets reflected in playbookSection — persisted on the hint. */
  playbookBulletIds: string[];
}

export interface GeneratedHintPayload {
  content: string;
  targetConcept: string;
  deliveryMode?: DeliveryMode;
  quality: HintQuality;
  recommendation: HintRecommendation;
}

export interface WaypointRuntime {
  generateHint(input: HintGenerationInput): Promise<GeneratedHintPayload>;
  /** Shared LLM completion for reliance judging, curator, and dedup. */
  complete(input: { system: string; user: string }): Promise<string>;
}

export interface WaypointDeps {
  store: WaypointStore;
  runtime: WaypointRuntime;
}

class WaypointCore implements WaypointAPI {
  constructor(private readonly deps: WaypointDeps) {}

  async hint(waypointCase: WaypointCase): Promise<WaypointHint> {
    await this.deps.store.saveCase(waypointCase);
    const bullets = getRelevantBullets(
      await this.deps.store.listBullets(),
      waypointCase.task.type
    );
    if (bullets.length > 0) {
      await this.deps.store.markBulletsSeen(bullets.map((b) => b.id));
    }
    const playbookSection = formatPlaybookPromptSection(bullets);
    const generated = await this.deps.runtime.generateHint({
      waypointCase,
      playbookSection,
      playbookBulletIds: bullets.map((b) => b.id),
    });
    const hint = WaypointHintSchema.parse({
      id: crypto.randomUUID(),
      caseId: waypointCase.id,
      content: generated.content,
      deliveryMode: generated.deliveryMode ?? "append",
      quality: generated.quality,
      targetConcept: generated.targetConcept,
      playbookBulletIds: bullets.map((b) => b.id),
      recommendation: generated.recommendation,
      createdAt: new Date(),
    });
    await this.deps.store.saveHint(hint);
    return hint;
  }

  async measureReliance(
    task: string,
    hint: string,
    output: string,
    method?: "logprob" | "judge"
  ): Promise<RelianceScore> {
    if (method === "logprob") {
      throw new Error(
        "Waypoint.measureReliance: logprob mode requires adapter-provided log probabilities; use judge (default)."
      );
    }
    return judgeRelianceWithModel(this.deps.runtime.complete, {
      task,
      hint,
      output,
    });
  }

  async recordOutcome(outcome: HintOutcome): Promise<void> {
    await this.deps.store.saveOutcome(outcome);
    const hint = await this.deps.store.getHint(outcome.hintId);
    if (!hint) {
      return;
    }
    const waypointCase = await this.deps.store.getCase(outcome.caseId);

    let reliance: RelianceScore | undefined;
    if (outcome.finalOutput) {
      const taskText = waypointCase
        ? [waypointCase.task.content, waypointCase.task.context]
            .filter(Boolean)
            .join("\n\n")
        : "(original task not stored — save cases via hint())";
      reliance = await judgeRelianceWithModel(this.deps.runtime.complete, {
        task: taskText,
        hint: hint.content,
        output: outcome.finalOutput,
      });
      await this.deps.store.saveRelianceScore(outcome.caseId, reliance);
    }

    if (hint.playbookBulletIds.length > 0) {
      const feedback = bulletFeedbackFromOutcome(outcome, reliance);
      await this.deps.store.applyBulletFeedback(
        hint.playbookBulletIds,
        feedback
      );
    }

    if (waypointCase?.agentId) {
      let profile =
        (await this.deps.store.getProfile(waypointCase.agentId)) ??
        createEmptyProfile(waypointCase.agentId);
      profile = mergeOutcomeIntoProfile(
        profile,
        waypointCase.task.type,
        outcome,
        reliance
      );
      await this.deps.store.saveProfile(profile);
    }

    if (waypointCase) {
      const bullet = await curateLesson(this.deps.runtime.complete, {
        waypointCase,
        hint,
        outcome,
        reliance,
      });
      if (bullet) {
        await this.deps.store.appendBullet(bullet);
        await deduplicateTaskTypeIfNeeded(
          this.deps.store,
          waypointCase.task.type,
          this.deps.runtime.complete
        );
      }
    }
  }

  async estimateDifficulty(
    task: Task,
    _agentProfile?: AgentCapabilityProfile
  ): Promise<DifficultyEstimate> {
    return DifficultyEstimateSchema.parse({
      level: "medium",
      score: 0.5,
      reasoning:
        "Placeholder difficulty estimate — replace with a calibrated model when available.",
      shouldHint: true,
      suggestedTaskType: task.type,
    });
  }

  async getAgentProfile(agentId: string): Promise<AgentCapabilityProfile> {
    return (
      (await this.deps.store.getProfile(agentId)) ??
      createEmptyProfile(agentId)
    );
  }
}

export function createWaypoint(deps: WaypointDeps): WaypointAPI {
  return new WaypointCore(deps);
}
