---
title: API
description: Public types and runtime primitives exposed by Ora.
order: 60
group: Reference
---

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
