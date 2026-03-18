import { describe, expect, test } from "bun:test";
import { OraPlaybackTracker } from "../src/tracker";
import { createEstimatedTimeline } from "../src/timeline";
import { tokenizeText } from "../src/tokenize";

describe("OraPlaybackTracker", () => {
  test("prefers boundary state for token lookup and character-based progress", () => {
    const text = "Hello world";
    const tracker = new OraPlaybackTracker({ text });

    const snapshot = tracker.updateFromBoundary(6, 900);

    expect(snapshot.source).toBe("boundary");
    expect(snapshot.currentCharIndex).toBe(6);
    expect(snapshot.currentTimeMs).toBe(900);
    expect(snapshot.token?.text).toBe("world");
    expect(snapshot.progress).toBeCloseTo(6 / text.length, 6);
  });

  test("uses timeline state for clock updates and progress updates", () => {
    const text = "alpha beta gamma";
    const tokens = tokenizeText(text);
    const timeline = createEstimatedTimeline({
      text,
      tokens,
      durationMs: 900,
    });
    const tracker = new OraPlaybackTracker({ text, tokens, timeline });

    const midSnapshot = tracker.updateFromClock(450);
    expect(midSnapshot.source).toBe("estimated-clock");
    expect(midSnapshot.progress).toBeCloseTo(0.5, 2);
    expect(midSnapshot.token).not.toBeNull();
    expect(midSnapshot.currentCharIndex).toBe(midSnapshot.token!.start);

    const progressSnapshot = tracker.updateFromProgress(1.5);
    expect(progressSnapshot.progress).toBe(1);
    expect(progressSnapshot.currentTimeMs).toBeCloseTo(900, 6);
    expect(progressSnapshot.token?.text).toBe("gamma");
  });

  test("sorts segments and resolves the active segment from character position", () => {
    const text = "alpha beta gamma";
    const tracker = new OraPlaybackTracker({
      text,
      segments: [
        { id: "late", start: 11, end: text.length, label: "Late" },
        { id: "early", start: 0, end: 10, label: "Early" },
      ],
    });

    expect(tracker.updateFromBoundary(2).segment?.id).toBe("early");
    expect(tracker.updateFromBoundary(12).segment?.id).toBe("late");
  });

  test("reset returns the tracker to idle state", () => {
    const tracker = new OraPlaybackTracker({ text: "hello world" });
    tracker.updateFromProviderMark(5, 400);

    const snapshot = tracker.reset();

    expect(snapshot.source).toBe("idle");
    expect(snapshot.currentTimeMs).toBe(0);
    expect(snapshot.currentCharIndex).toBe(0);
    expect(snapshot.progress).toBe(0);
  });
});
