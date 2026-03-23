---
title: Overview
description: What Ora is for and where it fits in a text-to-speech stack.
order: 1
group: Getting Started
---

Ora is a TypeScript-first library for text-to-speech provider integration, normalized synthesis contracts, and stable voice discovery.

It focuses on the coordination layer that usually gets messy in speech apps:

- provider registration and credential resolution
- consistent voice catalogs across providers
- a common request/synthesis response shape
- optional streaming and event forwarding

Ora is intentionally small. It does not try to own your synthesis provider, caching layer, or audio player UI.

## Boundary

Ora owns the runtime boundary.

That means Ora is responsible for:

- provider registration and request normalization
- the remote worker contract
- runtime voice discovery
- buffered/streaming synthesis and lifecycle events

Ora is not responsible for:

- model-specific inference internals
- Python or ML runtime setup
- host-specific package troubleshooting

Model servers such as MLX Audio sit behind Ora as backends. Ora can talk to them
through a remote worker or provider adapter without absorbing inference complexity.

## Core Pattern

A practical integration is:

- register providers once
- bind a provider client from the runtime
- list provider/voice capabilities
- request synthesis by provider and voice
- optionally consume stream events if available

## Core Pieces

- `createOraRuntime` creates a provider-aware runtime.
- `runtime.provider(id)` returns a bound provider client.
- `listProviderSummaries()` returns provider capability metadata.
- `listVoices(providerId)` returns normalized voice metadata.
- `synthesize(request)` returns a stable audio payload contract.
- `stream(request)` exposes optional live audio/timing events.

## Intended Consumers

Ora fits best in apps that need reliable speech output with provider interchangeability:

- read-aloud interfaces
- voice-selection UIs
- TTS service adapters and provider routers
- apps that need optional streaming playback hooks
