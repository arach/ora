import type { OraEstimatedTimelineOptions, OraTimedToken, OraTextToken } from "./types";
import { tokenizeText } from "./tokenize";

function getTokenWeightMs(
  token: OraTextToken,
  minimumTokenMs: number,
  punctuationPauseMs: number,
): number {
  const lengthWeight = token.isWord ? token.text.length * 38 : 0;
  const punctuationWeight = /^[,.;:!?)]$/.test(token.text) ? punctuationPauseMs : 0;
  const quoteWeight = /^["“”'‘’]$/.test(token.text) ? punctuationPauseMs * 0.35 : 0;

  return Math.max(minimumTokenMs, lengthWeight + punctuationWeight + quoteWeight);
}

export function createEstimatedTimeline(options: OraEstimatedTimelineOptions): OraTimedToken[] {
  const tokens = options.tokens ?? tokenizeText(options.text);
  const minimumTokenMs = options.minimumTokenMs ?? 80;
  const punctuationPauseMs = options.punctuationPauseMs ?? 90;
  const charactersPerSecond = options.charactersPerSecond ?? 14;

  if (tokens.length === 0) {
    return [];
  }

  const fallbackDurationMs = Math.max(1, (options.text.length / charactersPerSecond) * 1000);
  const targetDurationMs = options.durationMs ?? fallbackDurationMs;

  const rawWeights = tokens.map((token) => getTokenWeightMs(token, minimumTokenMs, punctuationPauseMs));
  const totalWeight = rawWeights.reduce((sum, value) => sum + value, 0) || targetDurationMs;
  const scale = targetDurationMs / totalWeight;

  let cursorMs = 0;

  return tokens.map((token, index) => {
    const weightMs = rawWeights[index] * scale;
    const startMs = cursorMs;
    const endMs = startMs + weightMs;
    cursorMs = endMs;

    return {
      ...token,
      startMs,
      endMs,
      weightMs,
    };
  });
}

export function findTimedTokenAtTime(timeline: OraTimedToken[], timeMs: number) {
  if (timeline.length === 0) {
    return null;
  }

  const clampedTimeMs = Math.max(0, timeMs);

  return (
    timeline.find((token) => clampedTimeMs >= token.startMs && clampedTimeMs < token.endMs) ??
    timeline.findLast((token) => token.startMs <= clampedTimeMs) ??
    timeline[0]
  );
}
