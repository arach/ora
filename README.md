# Ora

`Ora` is a TypeScript-first text-to-speech runtime for provider integration, voice discovery, and synthesis execution.

Repository: [github.com/arach/ora](https://github.com/arach/ora)

The package is intentionally small:

- provider registration and request normalization
- credential injection and runtime lifecycle instrumentation
- stable voice discovery
- buffered and streaming synthesis
- optional playback utilities for apps that need stateful tracking

## Why this exists

TTS providers and model hosts differ in API shape, authentication, and voice catalogs.
`Ora` gives you one integration surface so your app can:

- discover voices per provider
- synthesize speech through a stable request/response contract
- keep provider details and credentials out of host app business logic

## Install

```bash
bun add @arach/ora
```

## Basic setup

```ts
import {
  OraBufferedInstrumentationSink,
  OraMemoryCacheStore,
  OraMemoryCredentialStore,
  createOraRuntime,
  createOpenAiTtsProvider,
} from "@arach/ora";

const runtime = createOraRuntime({
  providers: [createOpenAiTtsProvider()],
  cacheStore: new OraMemoryCacheStore(),
  credentialStore: new OraMemoryCredentialStore(),
  instrumentation: [new OraBufferedInstrumentationSink()],
});

const openai = runtime.provider("openai");

openai.setCredentials({
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const voices = await openai.listVoices();
const response = await openai.synthesize({
  text: "Hello from Ora.",
  voice: voices[0]?.id ?? "alloy",
  format: "mp3",
});

const providers = await runtime.listProviderSummaries();
const cachedEntries = await runtime.queryCache({ provider: "openai" });
```

`response` is normalized into a consistent schema regardless of backend:
`response.audio` carries the real asset reference for playback: inline bytes, a URL, or both.

## Streaming

```ts
for await (const event of openai.stream({
  text: "Streaming is optional.",
  format: "wav",
  preferences: {
    priority: "responsiveness",
  },
})) {
  console.log(event.type, event.timeMs);
}
```

The `stream` API is shared across providers that support it.

## Remote worker

If you want to keep inference on another machine (for example a Mac mini), run a worker and connect it through `createRemoteTtsProvider(...)`.

Worker endpoints:

- `GET /health`
- `GET /v1/voices`
- `GET /v1/cache`
- `GET /v1/cache/:cacheKey`
- `DELETE /v1/cache/:cacheKey`
- `POST /v1/audio/speech`
- `POST /v1/audio/speech/stream`

## Advanced playback APIs

The following are optional if your app needs live synchronization:

- `OraPlaybackTracker`
- `OraDocumentSession`
- `OraPlaybackOrchestrator`

These remain available for UI-driven reading or highlighting flows without being part of the core usage narrative.

## Examples

- `bun run example:openai` writes a sample speech file to `.ora-output/openai-article-sample.mp3`
- `bun run example:openai-document` exercises paragraph-first document synthesis
- `bun run example:orchestrator` prints multi-unit orchestration state

## Development

```bash
bun install
bun run setup:local
bun run test
bun run check
bun run build
bun run docs:generate
bun run verify
```

The local gateway still serves the repo-backed fallback homepage while docs are generated and proxied in the existing scripts.
