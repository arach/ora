import { describe, expect, test } from "bun:test";
import {
  OraPlaybackTracker,
  createEstimatedTimeline,
  findTimedTokenAtTime,
  oraCorpus,
  tokenizeText,
} from "../src";

describe("pdf corpus fixtures", () => {
  test("tokenize public PDF excerpts into stable, non-empty word streams", () => {
    for (const entry of oraCorpus) {
      const tokens = tokenizeText(entry.excerpt);
      const wordTokens = tokens.filter((token) => token.isWord);

      expect(tokens.length).toBeGreaterThan(20);
      expect(wordTokens.length).toBeGreaterThan(15);
      expect(tokens[0]?.start).toBe(0);
      expect(tokens.at(-1)?.end).toBe(entry.excerpt.length);
    }
  });

  test("builds estimated timelines across realistic paragraph-length excerpts", () => {
    for (const entry of oraCorpus) {
      const tokens = tokenizeText(entry.excerpt);
      const timeline = createEstimatedTimeline({
        text: entry.excerpt,
        tokens,
        durationMs: 4_000,
      });

      expect(timeline).toHaveLength(tokens.length);
      expect(timeline[0]?.startMs).toBe(0);
      expect(timeline.at(-1)?.endMs).toBeCloseTo(4_000, 6);

      const midpoint = findTimedTokenAtTime(timeline, 2_000);
      expect(midpoint).not.toBeNull();
      expect(midpoint!.text.length).toBeGreaterThan(0);
    }
  });

  test("tracks boundary, provider, and clock state across excerpt segments", () => {
    for (const entry of oraCorpus) {
      const midpoint = Math.floor(entry.excerpt.length / 2);
      const tracker = new OraPlaybackTracker({
        text: entry.excerpt,
        segments: [
          { id: `${entry.id}-part-1`, start: 0, end: midpoint, label: "Part 1" },
          {
            id: `${entry.id}-part-2`,
            start: midpoint,
            end: entry.excerpt.length,
            label: "Part 2",
          },
        ],
      });

      const boundarySnapshot = tracker.updateFromBoundary(midpoint, 800);
      expect(boundarySnapshot.token).not.toBeNull();
      expect(boundarySnapshot.segment?.id).toBe(`${entry.id}-part-2`);

      const providerSnapshot = tracker.updateFromProviderMark(Math.max(0, midpoint - 12), 1_000);
      expect(providerSnapshot.source).toBe("provider-mark");
      expect(providerSnapshot.currentTimeMs).toBe(1_000);

      const clockSnapshot = tracker.updateFromClock(2_000);
      expect(clockSnapshot.source).toBe("estimated-clock");
      expect(clockSnapshot.progress).toBeGreaterThan(0);
      expect(clockSnapshot.progress).toBeLessThanOrEqual(1);
    }
  });
});
