# Ora Overview

## Purpose

Ora is a small TypeScript library for deriving playback state during text-to-speech.

## Core Surfaces

- `tokenizeText`
- `createEstimatedTimeline`
- `OraPlaybackTracker`

## Correctness Order

1. boundary events
2. provider marks
3. estimated clock updates

## Constraints

- keep token character ranges stable
- keep segment tracking generic
- do not treat estimated timing as ground truth
