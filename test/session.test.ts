import { describe, expect, test } from "bun:test";
import { OraDocumentSession } from "../src";

describe("OraDocumentSession", () => {
  test("splits text into ordered synthesis units", () => {
    const session = new OraDocumentSession({
      text: "Alpha sentence. Beta sentence. Gamma sentence. Delta sentence.",
      paragraphLength: 32,
      voice: "alloy",
      preferences: { priority: "quality" },
    });

    const snapshot = session.snapshot();

    expect(snapshot.units.length).toBeGreaterThan(1);
    expect(snapshot.units[0]?.start).toBe(0);
    expect(snapshot.units.at(-1)?.end).toBe(snapshot.text.length);
    expect(snapshot.units.every((unit) => unit.voice === "alloy")).toBe(true);
    expect(snapshot.units.every((unit) => unit.status === "idle")).toBe(true);
  });

  test("tracks queue, synthesis, ready, playing, done, and failed states", () => {
    const session = new OraDocumentSession({
      text: "One. Two. Three. Four.",
      paragraphLength: 8,
    });

    session.queue(0);
    session.startSynthesis(0);
    session.markReady(0, "https://example.com/0.mp3");
    session.startPlayback(0);
    session.markDone(0);
    session.queue(1);
    session.startSynthesis(1);
    const snapshot = session.markFailed(1, "provider timeout");

    expect(snapshot.doneCount).toBe(1);
    expect(snapshot.failedCount).toBe(1);
    expect(snapshot.units[0]?.audioUrl).toBe("https://example.com/0.mp3");
    expect(snapshot.units[1]?.error).toBe("provider timeout");
    expect(snapshot.units[1]?.attemptCount).toBe(1);
  });
});
