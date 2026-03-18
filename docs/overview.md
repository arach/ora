---
title: Overview
description: What Ora is for and where it fits in a TTS stack.
order: 1
group: Getting Started
---

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
