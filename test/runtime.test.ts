import { describe, expect, test } from "bun:test";
import {
  OraBufferedInstrumentationSink,
  OraMemoryCredentialStore,
  OraRuntime,
  createOraRuntime,
} from "../src";

describe("OraMemoryCredentialStore", () => {
  test("stores and returns provider credentials without exposing internal state", () => {
    const store = new OraMemoryCredentialStore();

    store.set("openai", { apiKey: "sk-test" });
    const credentials = store.get("openai");

    expect(credentials).toEqual({ apiKey: "sk-test" });

    credentials!.apiKey = "changed";
    expect(store.get("openai")).toEqual({ apiKey: "sk-test" });
    expect(store.providers()).toEqual(["openai"]);
  });
});

describe("OraRuntime", () => {
  test("resolves credentials, emits instrumentation, and delegates to the provider", async () => {
    const sink = new OraBufferedInstrumentationSink();
    const credentialStore = new OraMemoryCredentialStore();
    const nowValues = [
      new Date("2026-03-17T10:00:00.000Z"),
      new Date("2026-03-17T10:00:00.005Z"),
      new Date("2026-03-17T10:00:00.010Z"),
      new Date("2026-03-17T10:00:00.015Z"),
      new Date("2026-03-17T10:00:00.250Z"),
      new Date("2026-03-17T10:00:00.255Z"),
    ];

    const runtime = createOraRuntime({
      credentialStore,
      instrumentation: [sink],
      now: () => nowValues.shift() ?? new Date("2026-03-17T10:00:01.000Z"),
      createRequestId: () => "req_123",
    });

    await runtime.registerProvider({
      id: "openai",
      async synthesize(request, context) {
        expect(context.credentials).toEqual({ apiKey: "sk-live" });
        expect(context.requestId).toBe("req_123");
        expect(request.provider).toBe("openai");
        expect(context.plan.priority).toBe("quality");
        expect(context.plan.delivery).toBe("buffered");

        await context.emit({
          name: "synthesis:started",
          attributes: { phase: "provider-call" },
        });

        return {
          requestId: "ignored-by-runtime",
          cacheKey: "cache_123",
          provider: "openai",
          voice: request.voice ?? "alloy",
          rate: request.rate ?? 1,
          format: request.format ?? "mp3",
          cached: false,
          audioUrl: "https://example.com/audio.mp3",
          startedAt: "ignored",
          completedAt: "ignored",
          durationMs: 1,
        };
      },
    });

    runtime.setCredentials("openai", { apiKey: "sk-live" });

    const response = await runtime.synthesize({
      provider: "openai",
      text: "Hello from Ora",
      voice: "alloy",
      format: "mp3",
      preferences: {
        priority: "quality",
      },
    });

    expect(response.requestId).toBe("req_123");
    expect(response.cacheKey).toBe("cache_123");
    expect(response.durationMs).toBe(1);
    expect(response.audioUrl).toBe("https://example.com/audio.mp3");
    expect(sink.events.map((event) => event.name)).toEqual([
      "provider:registered",
      "synthesis:queued",
      "credentials:resolved",
      "synthesis:started",
      "synthesis:started",
      "synthesis:succeeded",
    ]);
    expect(sink.events[2]?.attributes).toEqual({ credentialCount: 1 });
  });

  test("throws when the provider is missing and emits a failure event for provider errors", async () => {
    const sink = new OraBufferedInstrumentationSink();
    const runtime = new OraRuntime({
      instrumentation: [sink],
      now: () => new Date("2026-03-17T10:00:00.000Z"),
      createRequestId: () => "req_missing",
    });

    await expect(
      runtime.synthesize({
        provider: "missing",
        text: "hello",
      }),
    ).rejects.toThrow('No Ora provider registered for "missing".');

    await runtime.registerProvider({
      id: "broken",
      async synthesize() {
        throw new Error("Provider exploded");
      },
    });

    await expect(
      runtime.synthesize({
        provider: "broken",
        text: "hello",
      }),
    ).rejects.toThrow("Provider exploded");

    expect(sink.events.at(-1)?.name).toBe("synthesis:failed");
    expect(sink.events.at(-1)?.error?.message).toBe("Provider exploded");
  });

  test("supports streaming provider adapters with normalized lifecycle events", async () => {
    const sink = new OraBufferedInstrumentationSink();
    const runtime = new OraRuntime({
      instrumentation: [sink],
      now: () => new Date("2026-03-17T10:00:00.000Z"),
      createRequestId: () => "req_stream",
    });

    await runtime.registerProvider({
      id: "gemini",
      async synthesize() {
        throw new Error("not used");
      },
      async stream(_request, context) {
        expect(context.requestId).toBe("req_stream");
        expect(context.plan.priority).toBe("responsiveness");
        expect(context.plan.delivery).toBe("streaming");

        async function* events() {
          yield {
            type: "audio" as const,
            audio: new Uint8Array([1, 2, 3]),
            mimeType: "audio/pcm",
          };
          yield {
            type: "boundary" as const,
            charIndex: 6,
            timeMs: 120,
          };
        }

        return events();
      },
    });

    const events = [];

    for await (const event of runtime.stream({
      provider: "gemini",
      text: "stream me",
      format: "wav",
      preferences: {
        priority: "responsiveness",
      },
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(["started", "audio", "boundary", "completed"]);
    expect(events.every((event) => event.requestId === "req_stream")).toBe(true);
    expect(events.every((event) => event.provider === "gemini")).toBe(true);
    expect(sink.events.at(-1)?.name).toBe("synthesis:succeeded");
    expect(sink.events.at(-1)?.attributes?.mode).toBe("stream");
  });
});
