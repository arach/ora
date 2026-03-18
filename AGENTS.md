# ora

> TypeScript-first text-to-speech runtime primitives and playback tracking

## Critical Context

**IMPORTANT:** Read these rules before making any changes:

- Ora is a tracking layer for text-to-speech playback state, not a full synthesis client.
- Boundary events are authoritative and estimated timelines are a fallback.
- Segment tracking should stay generic so host apps can map paragraphs, sentences, or arbitrary ranges.

## Project Structure

| Component | Path | Purpose |
|-----------|------|---------|
| Api | `src/index.ts` | |
| Tokenize | `src/tokenize.ts` | |
| Timeline | `src/timeline.ts` | |
| Tracker | `src/tracker.ts` | |
| Types | `src/types.ts` | |
| Docs | `docs/` | |

## Quick Navigation

- Working with **tracker**? → Preserve the correctness ladder: boundary updates outrank provider marks, which outrank estimated clock state.
- Working with **timeline**? → Treat estimated timing heuristics as configurable approximations, not truth.
- Working with **tokenize**? → Character ranges and token boundaries must stay stable because downstream playback state depends on them.

## Overview

> What Ora is for and where it fits in a TTS stack.

Ora is a TypeScript-first library for text-to-speech runtimes, playback state, and text-follow tracking.

It focuses on the coordination layer that usually gets messy in speech UIs:

- tokenizing text into stable character ranges
- estimating token timelines when exact timestamps are unavailable
- tracking current token and segment state from boundary events, provider marks, or the clock

Ora is intentionally small. It does not try to own your synthesis provider, caching layer, or audio player UI.

## Correctness Ladder

Playback state should be resolved in this order:

1. Exact runtime boundary events.
2. Provider word marks or timestamps.
3. Clock-driven estimated token timelines.

Ora currently implements all three of those surfaces.

## Core Pieces

- `tokenizeText` turns source text into stable token ranges.
- `createEstimatedTimeline` converts those tokens into an approximate playback schedule.
- `OraPlaybackTracker` merges boundary, provider, and clock updates into a single snapshot shape.

## Intended Consumers

Ora fits best in apps that need visible reading state while audio is playing:

- read-aloud interfaces
- highlighted word or sentence playback
- paragraph-follow views
- editor or study tools with synchronized speech

## Quickstart

> Get tokenization, estimated timing, and playback snapshots running quickly.

## Install

```bash
bun add @arach/ora
```

## Basic Flow

```ts
import {
  OraPlaybackTracker,
  createEstimatedTimeline,
  tokenizeText,
} from "@arach/ora";

const text = "Drop in a PDF and shape the reading surface from the file outward.";
const tokens = tokenizeText(text);
const timeline = createEstimatedTimeline({
  text,
  tokens,
  durationMs: 4200,
});

const tracker = new OraPlaybackTracker({
  text,
  tokens,
  timeline,
  segments: [
    { id: "paragraph-1", start: 0, end: text.length, label: "Paragraph 1" },
  ],
});

tracker.updateFromBoundary(18, 950);
console.log(tracker.snapshot());

tracker.updateFromClock(2000);
console.log(tracker.snapshot());
```

## Integration Pattern

1. Tokenize once when the text changes.
2. Create or hydrate a timed token timeline.
3. Feed real boundary or provider-mark updates into the tracker when available.
4. Fall back to `updateFromClock` during playback when exact timing is unavailable.
5. Read `snapshot()` to drive word, sentence, or segment highlighting in the host UI.

## Segment Ranges

Segments are generic character ranges. They can represent:

- paragraphs
- sentences
- captions
- arbitrary host-app spans

That keeps Ora independent from any specific document model.

## API

> Public types and runtime primitives exposed by Ora.

## Public Exports

Ora exposes these primary surfaces:

- `tokenizeText(text)`
- `findTokenAtCharIndex(tokens, charIndex)`
- `createEstimatedTimeline(options)`
- `findTimedTokenAtTime(timeline, timeMs)`
- `OraPlaybackTracker`

## Key Types

### `OraTextToken`

Represents a token with character offsets:

- `index`
- `text`
- `start`
- `end`
- `isWord`

### `OraTimedToken`

Extends `OraTextToken` with timing information:

- `startMs`
- `endMs`
- `weightMs`

### `OraPlaybackSnapshot`

Current derived playback state:

- `source`
- `currentTimeMs`
- `currentCharIndex`
- `progress`
- `token`
- `tokenIndex`
- `segment`
- `segmentIndex`

## Tracker Update Sources

### `updateFromBoundary(charIndex, timeMs?)`

Use this when the runtime emits exact character boundary callbacks.

### `updateFromProviderMark(charIndex, timeMs?)`

Use this when the synthesis backend provides word or token marks.

### `updateFromClock(timeMs)`

Use this when no authoritative timing exists and you need estimated progress.

### `updateFromProgress(progress)`

Use this when the host app only knows a normalized playback fraction.

## Design Constraints

- boundary and provider updates should stay cheap and deterministic
- estimated timing should stay configurable
- token and segment selection should remain purely range-based

---
Generated by [Dewey 0.3.4](https://github.com/arach/dewey) | Last updated: 2026-03-17