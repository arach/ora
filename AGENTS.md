# ora

> TypeScript-first text-to-speech runtime for providers, voices, and synthesis

## Critical Context

**IMPORTANT:** Read these rules before making any changes:

- Ora is a text-to-speech runtime surface for provider integration, voice discovery, and synthesis.
- Provider and voice metadata should stay stable so host apps can build selectors and adapters against Ora.
- Playback tracking APIs are optional advanced surfaces, not the primary product position.

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

> What Ora is for and where it fits in a text-to-speech stack.

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

## Quickstart

> Get text-to-speech synthesis and voice discovery running quickly.

## Install

```bash
bun add @arach/ora
```

## Scope

Ora is the coordination layer around speech synthesis, not a model runtime.

If you are running a local model elsewhere, the recommended shape is:

1. run the model service on the host
2. run an Ora worker in front of it
3. connect with `createRemoteTtsProvider(...)`

That keeps Ora&apos;s API stable while model setup stays in backend-specific recipes.

## Basic Flow

```ts
import {
  OraMemoryCacheStore,
  createOraRuntime,
  createOpenAiTtsProvider,
} from "@arach/ora";

const runtime = createOraRuntime({
  providers: [createOpenAiTtsProvider()],
  cacheStore: new OraMemoryCacheStore(),
});

const openai = runtime.provider("openai");
openai.setCredentials({ apiKey: process.env.OPENAI_API_KEY ?? "" });

const voices = await openai.listVoices();
const response = await openai.synthesize({
  text: "Hello from Ora.",
  voice: voices[0]?.id ?? "alloy",
  format: "mp3",
});

const entries = await runtime.queryCache({ provider: "openai" });

console.log(response.audio?.url, response.audio?.data, response.durationMs, entries.length);
```

## Streaming Flow

```ts
for await (const event of openai.stream({
  text: "Hello from a stream.",
  preferences: {
    priority: "responsiveness",
  },
})) {
  if (event.type === "audio") {
    // append event.audio
  }
}
```

For remote deployments and backend recipes, see `docs/remote-worker.md`.

## API

> Public types and runtime primitives exposed by Ora.

## Public Exports

Ora exposes these primary surfaces:

- `createOraRuntime(options)`
- `createOpenAiTtsProvider(options)`
- `createRemoteTtsProvider(options)`
- `createHttpOraWorkerBackend(...)`
- `createMockOraWorkerBackend(...)`
- `createOraWorkerServer(...)`
- `OraRuntime`
- `OraProviderClient`
- `OraAudioAsset`
- `OraMemoryCacheStore`
- `OraCacheEntry`
- `OraCacheQuery`
- `OraMemoryCredentialStore`
- `OraVoice`
- `OraSynthesisRequest`
- `OraSynthesisResponse`

## Core Types

### `OraVoice`

Structured voice metadata returned by provider catalogs:

- `id`
- `label`
- `provider`
- `locale`
- `styles`
- `tags`
- `previewText`
- `previewUrl`
- `metadata`

### `OraProviderSummary`

Runtime-level provider metadata used by `listProviderSummaries()`:

- `id`
- `label`
- `hasCredentials`
- `capabilities`

### `OraSynthesisResponse`

Normalized synthesis return shape:

- `audio`
- `audioUrl`
- `audioData`
- `voice`
- `format`
- `durationMs`
- `metadata`
- `cached`

## Runtime Primitives

- `provider(id)`
- `providerClients()`
- `getCacheEntry(key)`
- `queryCache(query)`
- `deleteCacheEntry(key)`
- `setCredentials(provider, credentials)`
- `getCredentials(provider)`
- `credentialProviders()`
- `registerProvider(provider)`
- `getProvider(id)`
- `listProviders()`
- `listProviderSummaries()`
- `listVoices(providerId)`
- `synthesize(request)`
- `stream(request)`

## Bound Provider Client

`runtime.provider("openai")` returns an `OraProviderClient` bound to one provider.

That client can:

- manage provider credentials
- read provider summary/capabilities
- list voices
- synthesize without manually passing `provider`
- stream without manually passing `provider`

## Runtime Boundary

Ora&apos;s worker and provider APIs assume a clean backend contract:

- register providers
- list providers
- list voices
- query cache entries
- report health
- synthesize audio
- optionally stream audio and timing metadata

## Worker Routes

- `GET /health`
- `GET /v1/voices`
- `GET /v1/cache`
- `GET /v1/cache/:cacheKey`
- `DELETE /v1/cache/:cacheKey`
- `POST /v1/audio/speech`
- `POST /v1/audio/speech/stream`

The worker may invoke speech through:

- a local OS service
- an in-process runtime
- an upstream HTTP model server

## Advanced Tracking (Optional)

These are available if your app needs synced reading UI:

- `OraPlaybackTracker`
- `OraDocumentSession`
- `OraPlaybackOrchestrator`
- `findTokenAtCharIndex(...)`
- `createEstimatedTimeline(...)`
- `findTimedTokenAtTime(...)`
- `updateFromBoundary(...)`
- `updateFromProviderMark(...)`
- `updateFromClock(...)`
- `updateFromProgress(...)`

They are independent and optional for the core text-to-speech workflow.

---
Generated by [Dewey 0.3.4](https://github.com/arach/dewey) | Last updated: 2026-03-23