---
title: API
description: Public types and runtime primitives exposed by Ora.
order: 60
group: Reference
---

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
