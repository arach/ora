import type {
  OraPlaybackSegment,
  OraPlaybackSnapshot,
  OraPlaybackSource,
  OraPlaybackTrackerOptions,
  OraTextToken,
  OraTimedToken,
} from "./types";
import { createEstimatedTimeline, findTimedTokenAtTime } from "./timeline";
import { findTokenAtCharIndex, tokenizeText } from "./tokenize";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function findSegmentAtCharIndex(segments: OraPlaybackSegment[], charIndex: number) {
  if (segments.length === 0) {
    return { segment: null, segmentIndex: -1 };
  }

  const segmentIndex = segments.findIndex(
    (segment) => charIndex >= segment.start && charIndex < segment.end,
  );

  if (segmentIndex >= 0) {
    return {
      segment: segments[segmentIndex] ?? null,
      segmentIndex,
    };
  }

  const fallbackIndex = segments.findLastIndex((segment) => segment.start <= charIndex);

  if (fallbackIndex >= 0) {
    return {
      segment: segments[fallbackIndex] ?? null,
      segmentIndex: fallbackIndex,
    };
  }

  return {
    segment: segments[0] ?? null,
    segmentIndex: segments[0] ? 0 : -1,
  };
}

export class OraPlaybackTracker {
  readonly text: string;
  readonly tokens: OraTextToken[];
  readonly segments: OraPlaybackSegment[];
  readonly timeline: OraTimedToken[];

  private currentTimeMs = 0;
  private currentCharIndex = 0;
  private source: OraPlaybackSource = "idle";

  constructor(options: OraPlaybackTrackerOptions) {
    this.text = options.text;
    this.tokens = options.tokens ?? tokenizeText(options.text);
    this.segments = [...(options.segments ?? [])].sort((left, right) => left.start - right.start);
    this.timeline =
      options.timeline ?? createEstimatedTimeline({ text: options.text, tokens: this.tokens });
  }

  reset() {
    this.currentTimeMs = 0;
    this.currentCharIndex = 0;
    this.source = "idle";
    return this.snapshot();
  }

  updateFromBoundary(charIndex: number, timeMs = this.currentTimeMs) {
    this.source = "boundary";
    this.currentCharIndex = clamp(charIndex, 0, this.text.length);
    this.currentTimeMs = Math.max(0, timeMs);

    return this.snapshot();
  }

  updateFromProviderMark(charIndex: number, timeMs = this.currentTimeMs) {
    this.source = "provider-mark";
    this.currentCharIndex = clamp(charIndex, 0, this.text.length);
    this.currentTimeMs = Math.max(0, timeMs);

    return this.snapshot();
  }

  updateFromClock(timeMs: number) {
    this.source = "estimated-clock";
    this.currentTimeMs = Math.max(0, timeMs);

    const activeToken = findTimedTokenAtTime(this.timeline, this.currentTimeMs);
    this.currentCharIndex = activeToken?.start ?? 0;

    return this.snapshot();
  }

  updateFromProgress(progress: number) {
    const totalDurationMs = this.timeline[this.timeline.length - 1]?.endMs ?? 0;
    return this.updateFromClock(totalDurationMs * clamp(progress, 0, 1));
  }

  snapshot(): OraPlaybackSnapshot {
    const token =
      this.source === "estimated-clock"
        ? findTimedTokenAtTime(this.timeline, this.currentTimeMs)
        : findTokenAtCharIndex(this.tokens, this.currentCharIndex);
    const tokenIndex = token?.index ?? -1;

    const { segment, segmentIndex } = findSegmentAtCharIndex(this.segments, this.currentCharIndex);
    const totalDurationMs = this.timeline[this.timeline.length - 1]?.endMs ?? 0;
    const progress =
      this.source === "estimated-clock" && totalDurationMs > 0
        ? clamp(this.currentTimeMs / totalDurationMs, 0, 1)
        : this.text.length > 0
          ? clamp(this.currentCharIndex / this.text.length, 0, 1)
          : 0;

    return {
      source: this.source,
      currentTimeMs: this.currentTimeMs,
      currentCharIndex: this.currentCharIndex,
      progress,
      token: token ?? null,
      tokenIndex,
      segment,
      segmentIndex,
    };
  }
}
