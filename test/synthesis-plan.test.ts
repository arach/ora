import { describe, expect, test } from "bun:test";
import { resolveSynthesisPlan } from "../src";

describe("resolveSynthesisPlan", () => {
  test("prefers buffered high-quality output when priority is quality", () => {
    expect(
      resolveSynthesisPlan({
        provider: "openai",
        text: "hello",
        preferences: {
          priority: "quality",
        },
      }),
    ).toEqual({
      priority: "quality",
      delivery: "buffered",
      format: "mp3",
      bitrateKbps: 192,
      sampleRateHz: 48_000,
      cacheStrategy: "full-audio",
    });
  });

  test("prefers streaming and lower-latency defaults when priority is responsiveness", () => {
    expect(
      resolveSynthesisPlan({
        provider: "gemini",
        text: "hello",
        preferences: {
          priority: "responsiveness",
        },
      }),
    ).toEqual({
      priority: "responsiveness",
      delivery: "streaming",
      format: "opus",
      bitrateKbps: 64,
      sampleRateHz: 24_000,
      cacheStrategy: "progressive",
    });
  });

  test("respects explicit delivery and audio overrides", () => {
    expect(
      resolveSynthesisPlan({
        provider: "elevenlabs",
        text: "hello",
        format: "wav",
        preferences: {
          priority: "balanced",
          delivery: "streaming",
          bitrateKbps: 96,
          sampleRateHz: 32_000,
        },
      }),
    ).toEqual({
      priority: "balanced",
      delivery: "streaming",
      format: "wav",
      bitrateKbps: 96,
      sampleRateHz: 32_000,
      cacheStrategy: "progressive",
    });
  });
});
