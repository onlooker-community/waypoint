import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { judgeReliance } from "./judge.js";

function makeResponse(score: string, referenced: string, reasoning: string) {
  return {
    content: [
      {
        type: "text",
        text: [
          "<reliance_assessment>",
          `  <score>${score}</score>`,
          `  <hint_explicitly_referenced>${referenced}</hint_explicitly_referenced>`,
          `  <reasoning>${reasoning}</reasoning>`,
          "</reliance_assessment>",
        ].join("\n"),
      },
    ],
  };
}

describe("judgeReliance", () => {
  beforeEach(() => {
    process.env["ANTHROPIC_API_KEY"] = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env["ANTHROPIC_API_KEY"];
  });

  it("parses a low reliance score correctly", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => makeResponse("0.2", "false", "Output was fully independent"),
    } as unknown as Response);

    const result = await judgeReliance("task", "hint", "output");
    expect(result.score).toBe(0.2);
    expect(result.assessment).toBe("low");
    expect(result.hintExplicitlyReferenced).toBe(false);
    expect(result.method).toBe("judge");
    expect(result.reasoning).toBe("Output was fully independent");
  });

  it("parses a high reliance score correctly", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => makeResponse("0.8", "false", "Heavily dependent on hint"),
    } as unknown as Response);

    const result = await judgeReliance("task", "hint", "output");
    expect(result.score).toBe(0.8);
    expect(result.assessment).toBe("high");
  });

  it("assessment is 'medium' for a score in [0.35, 0.65)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => makeResponse("0.5", "false", "Borderline"),
    } as unknown as Response);

    const result = await judgeReliance("task", "hint", "output");
    expect(result.assessment).toBe("medium");
  });

  it("bumps score to at least 0.6 when hint is explicitly referenced", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeResponse("0.3", "true", "Agent said 'As suggested, I'll try parameterizing'"),
    } as unknown as Response);

    const result = await judgeReliance("task", "hint", "output");
    expect(result.score).toBeGreaterThanOrEqual(0.6);
    expect(result.hintExplicitlyReferenced).toBe(true);
  });

  it("does not lower score when hint is explicitly referenced and score is already high", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => makeResponse("0.9", "true", "Transcription"),
    } as unknown as Response);

    const result = await judgeReliance("task", "hint", "output");
    expect(result.score).toBe(0.9);
  });

  it("falls back to score 0.5 when score tag is unparseable", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "I cannot determine the reliance score." }],
      }),
    } as unknown as Response);

    const result = await judgeReliance("task", "hint", "output");
    expect(result.score).toBe(0.5);
    expect(result.assessment).toBe("medium");
  });

  it("uses fallback reasoning text when reasoning tag is missing", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: [{ type: "text", text: "<reliance_assessment><score>0.4</score></reliance_assessment>" }],
      }),
    } as unknown as Response);

    const result = await judgeReliance("task", "hint", "output");
    expect(result.reasoning).toBeTruthy();
  });

  it("throws when the API returns a non-ok status", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as unknown as Response);

    await expect(judgeReliance("task", "hint", "output")).rejects.toThrow(
      "Anthropic API error 401"
    );
  });

  it("throws when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env["ANTHROPIC_API_KEY"];
    await expect(judgeReliance("task", "hint", "output")).rejects.toThrow(
      "ANTHROPIC_API_KEY"
    );
  });

  it("sends the prompt to the Anthropic API with correct headers", async () => {
    const mockFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => makeResponse("0.3", "false", "Independent"),
    } as unknown as Response);

    await judgeReliance("my task", "my hint", "my output");

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");

    const body = JSON.parse(init.body as string) as { messages: Array<{ content: string }> };
    expect(body.messages[0]?.content).toContain("my task");
    expect(body.messages[0]?.content).toContain("my hint");
    expect(body.messages[0]?.content).toContain("my output");
  });
});
