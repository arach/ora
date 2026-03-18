import { describe, expect, test } from "bun:test";
import { OraDocumentSession, OraPlaybackOrchestrator } from "../src";

describe("OraPlaybackOrchestrator", () => {
  test("tracks buffered and pending units while advancing playback", () => {
    const session = new OraDocumentSession({
      text:
        "Alpha sentence is a little longer for chunking. Beta sentence is a little longer for chunking. Gamma sentence is a little longer for chunking. Delta sentence is a little longer for chunking.",
      paragraphLength: 60,
      voice: "alloy",
    });
    const orchestrator = new OraPlaybackOrchestrator({
      session: session.snapshot(),
    });

    orchestrator.queue(0);
    orchestrator.startSynthesis(0, 180);
    orchestrator.markReady(0, "https://example.com/0.mp3");
    orchestrator.startPlayback(0, 400);

    const activeSnapshot = orchestrator.snapshot();
    expect(activeSnapshot.activeUnit?.index).toBe(0);
    expect(activeSnapshot.firstAudioMs).toBe(180);
    expect(activeSnapshot.bufferedUnitCount).toBe(1);
    expect(activeSnapshot.tracker.segment?.id).toBe(session.snapshot().units[0]?.id);

    orchestrator.markDone(0, 900);
    orchestrator.queue(1);
    orchestrator.startSynthesis(1, 950);
    orchestrator.markReady(1);
    orchestrator.startPlayback(1, 1000);
    const nextSnapshot = orchestrator.advance(1200);

    expect(nextSnapshot.activeUnit?.index).toBe(1);
    expect(nextSnapshot.nextUnit?.index).toBeGreaterThan(1);
    expect(nextSnapshot.pendingUnitCount).toBeGreaterThan(0);
    expect(nextSnapshot.tracker.progress).toBeGreaterThan(0);
  });

  test("marks failed units and keeps them visible in the snapshot", () => {
    const session = new OraDocumentSession({
      text: "One. Two. Three. Four.",
      paragraphLength: 8,
    });
    const orchestrator = new OraPlaybackOrchestrator({
      session: session.snapshot(),
    });

    orchestrator.queue(0);
    orchestrator.startSynthesis(0);
    const snapshot = orchestrator.markFailed(0, "synthesis failed");

    expect(snapshot.session.failedCount).toBe(1);
    expect(snapshot.session.units[0]?.error).toBe("synthesis failed");
  });

  test("synthesizes a unit through the runtime and stores returned audio data", async () => {
    const session = new OraDocumentSession({
      text: "Alpha sentence. Beta sentence. Gamma sentence.",
      paragraphLength: 24,
      voice: "alloy",
      preferences: { priority: "balanced" },
    });
    const orchestrator = new OraPlaybackOrchestrator({
      session: session.snapshot(),
    });

    const snapshot = await orchestrator.synthesizeUnit(
      {
        synthesize: async (request) => ({
          requestId: "req_1",
          cacheKey: "cache_1",
          provider: request.provider,
          voice: request.voice ?? "alloy",
          rate: request.rate ?? 1,
          format: request.format ?? "mp3",
          cached: false,
          audioUrl: "https://example.com/unit.mp3",
          audioData: new Uint8Array([1, 2, 3]),
          mimeType: "audio/mpeg",
          startedAt: "2026-03-18T00:00:00.000Z",
          completedAt: "2026-03-18T00:00:00.100Z",
          durationMs: 100,
        }),
      },
      {
        provider: "openai",
        index: 0,
        startLatencyMs: 180,
      },
    );

    expect(snapshot.session.readyCount).toBe(1);
    expect(snapshot.session.units[0]?.audioUrl).toBe("https://example.com/unit.mp3");
    expect(snapshot.session.units[0]?.audioData).toEqual(new Uint8Array([1, 2, 3]));
    expect(snapshot.session.units[0]?.mimeType).toBe("audio/mpeg");
    expect(snapshot.session.units[0]?.durationMs).toBe(100);
    expect(snapshot.firstAudioMs).toBe(180);
  });
});
