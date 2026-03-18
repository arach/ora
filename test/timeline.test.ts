import { describe, expect, test } from "bun:test";
import { createEstimatedTimeline, findTimedTokenAtTime } from "../src/timeline";
import { tokenizeText } from "../src/tokenize";

describe("createEstimatedTimeline", () => {
  test("scales token timing to the requested duration", () => {
    const text = "Hello, world!";
    const timeline = createEstimatedTimeline({
      text,
      durationMs: 3000,
    });

    expect(timeline).toHaveLength(4);
    expect(timeline[0]?.startMs).toBe(0);
    expect(timeline[timeline.length - 1]?.endMs).toBeCloseTo(3000, 6);

    for (let index = 1; index < timeline.length; index += 1) {
      expect(timeline[index]?.startMs).toBeCloseTo(timeline[index - 1]!.endMs, 6);
    }
  });

  test("gives punctuation more weight than a plain minimum token duration", () => {
    const tokens = tokenizeText("A!");
    const timeline = createEstimatedTimeline({
      text: "A!",
      tokens,
      minimumTokenMs: 10,
      punctuationPauseMs: 120,
      durationMs: 1000,
    });

    expect(timeline[1]!.weightMs).toBeGreaterThan(timeline[0]!.weightMs);
  });
});

describe("findTimedTokenAtTime", () => {
  test("clamps negative time and falls back to the final token after the end", () => {
    const timeline = createEstimatedTimeline({
      text: "alpha beta",
      durationMs: 1000,
    });

    expect(findTimedTokenAtTime(timeline, -50)?.text).toBe("alpha");
    expect(findTimedTokenAtTime(timeline, 10_000)?.text).toBe("beta");
  });

  test("returns null for an empty timeline", () => {
    expect(findTimedTokenAtTime([], 10)).toBeNull();
  });
});
