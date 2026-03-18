---
title: Quickstart
description: Get tokenization, estimated timing, and playback snapshots running quickly.
order: 2
group: Getting Started
---

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
