import { describe, expect, test } from "bun:test";
import { createOpenAiTtsProvider } from "../src";

describe("createOpenAiTtsProvider", () => {
  test("lists a stable OpenAI voice catalog", async () => {
    const provider = createOpenAiTtsProvider({
      apiKey: "sk-test",
    });

    const voices = await provider.listVoices?.();

    expect(voices?.some((voice) => voice.id === "alloy")).toBe(true);
    expect(voices?.every((voice) => voice.provider === "openai")).toBe(true);
    expect(voices?.every((voice) => typeof voice.label === "string" && voice.label.length > 0)).toBe(
      true,
    );
  });

  test("uses quality and responsiveness tradeoffs to pick OpenAI speech models", async () => {
    const calls: Array<{ body: Record<string, unknown> }> = [];
    const provider = createOpenAiTtsProvider({
      apiKey: "sk-test",
      fetch: async (_input, init) => {
        calls.push({
          body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
        });

        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
    });

    await provider.synthesize(
      {
        provider: "openai",
        text: "hello",
        format: "mp3",
      },
      {
        requestId: "req_quality",
        provider: "openai",
        credentials: {},
        plan: {
          priority: "quality",
          delivery: "buffered",
          format: "mp3",
          bitrateKbps: 192,
          sampleRateHz: 48_000,
          cacheStrategy: "full-audio",
        },
        emit: async () => {},
      },
    );

    await provider.synthesize(
      {
        provider: "openai",
        text: "hello",
        format: "mp3",
      },
      {
        requestId: "req_fast",
        provider: "openai",
        credentials: {},
        plan: {
          priority: "responsiveness",
          delivery: "streaming",
          format: "mp3",
          bitrateKbps: 64,
          sampleRateHz: 24_000,
          cacheStrategy: "progressive",
        },
        emit: async () => {},
      },
    );

    expect(calls[0]?.body.model).toBe("tts-1-hd");
    expect(calls[1]?.body.model).toBe("tts-1");
  });

  test("forces gpt-4o-mini-tts when instructions are present", async () => {
    const provider = createOpenAiTtsProvider({
      apiKey: "sk-test",
      fetch: async (_input, init) =>
        new Response(init?.body ? new Uint8Array([4, 5, 6]) : null, { status: 200 }),
    });

    const response = await provider.synthesize(
      {
        provider: "openai",
        text: "hello",
        instructions: "Speak warmly.",
        format: "wav",
      },
      {
        requestId: "req_instructions",
        provider: "openai",
        credentials: {},
        plan: {
          priority: "quality",
          delivery: "buffered",
          format: "wav",
          bitrateKbps: 192,
          sampleRateHz: 48_000,
          cacheStrategy: "full-audio",
        },
        emit: async () => {},
      },
    );

    expect(response.metadata?.model).toBe("gpt-4o-mini-tts");
    expect(response.audio).toEqual({
      data: new Uint8Array([4, 5, 6]),
      mimeType: "audio/wav",
    });
    expect(response.audioData).toEqual(new Uint8Array([4, 5, 6]));
    expect(response.audioUrl).toBeUndefined();
    expect(response.mimeType).toBe("audio/wav");
  });
});
