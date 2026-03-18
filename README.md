# Ora

`Ora` is a TypeScript-first library for text-to-speech runtimes, playback state, and text-follow tracking.

Repository: [github.com/arach/ora](https://github.com/arach/ora)

The initial package is intentionally small:

- synthesis request, provider, and streaming runtime types
- provider registration and credential storage primitives
- instrumentation hooks for synthesis lifecycle events
- paragraph-first document sessions and playback orchestration
- text tokenization and estimated playback timelines
- a playback tracker that can follow exact boundary events or fall back to clock-based estimates

## Why this exists

TTS itself is usually simple. The hard part is keeping UI state honest while audio is playing:

- which character are we at?
- which word should be highlighted?
- which paragraph or segment is active?
- how do we recover when a provider does not expose word timing?

`Ora` handles that tracking layer separately from any app-specific document model.

It also provides a thin runtime abstraction for TTS providers so apps can keep provider-specific HTTP details at the edge while centralizing:

- provider registration
- credential resolution
- synthesis lifecycle instrumentation
- streaming audio and boundary events
- paragraph queueing, prefetch, and playback handoff

## Correctness ladder

The tracking order should be:

1. Exact speech boundary events from the runtime.
2. Provider word marks or timestamps from the synthesis backend.
3. A clock-driven estimated token timeline.
4. Forced alignment against rendered audio for prerecorded assets.

`Ora` currently implements 1 to 3.

## Install

```bash
bun add @arach/ora
```

## Usage

```ts
import {
  OraBufferedInstrumentationSink,
  OraMemoryCredentialStore,
  OraPlaybackTracker,
  createOraRuntime,
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
tracker.snapshot();

tracker.updateFromClock(2000);
tracker.snapshot();

const runtime = createOraRuntime({
  credentialStore: new OraMemoryCredentialStore(),
  instrumentation: [new OraBufferedInstrumentationSink()],
});
```

## Runtime

Provider adapters stay small and explicit:

```ts
import { createOraRuntime } from "@arach/ora";

const runtime = createOraRuntime();

await runtime.registerProvider({
  id: "openai",
  async synthesize(request, context) {
    const apiKey = context.credentials.apiKey;

    return {
      requestId: context.requestId,
      cacheKey: `${request.provider}:${request.voice ?? "default"}:${request.text}`,
      provider: "openai",
      voice: request.voice ?? "alloy",
      rate: request.rate ?? 1,
      format: request.format ?? "mp3",
      cached: false,
      audioUrl: "/audio/example.mp3",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 180,
      metadata: {
        hasApiKey: Boolean(apiKey),
      },
    };
  },
});

runtime.setCredentials("openai", { apiKey: process.env.OPENAI_API_KEY ?? "" });

const response = await runtime.synthesize({
  provider: "openai",
  text: "Hello from Ora",
  voice: "alloy",
});
```

Streaming providers are optional and use the same runtime:

```ts
await runtime.registerProvider({
  id: "gemini",
  async synthesize() {
    throw new Error("Use stream() for this provider.");
  },
  async stream(_request, context) {
    async function* events() {
      yield {
        type: "audio" as const,
        audio: new Uint8Array([1, 2, 3]),
        mimeType: "audio/pcm",
      };

      yield {
        type: "boundary" as const,
        charIndex: 6,
        timeMs: 120,
      };
    }

    return events();
  },
});

for await (const event of runtime.stream({
  provider: "gemini",
  text: "stream me",
})) {
  console.log(event.type, event.requestId);
}
```

## Document Playback

Ora also includes paragraph-first primitives for page-sized reading surfaces:

```ts
import {
  OraDocumentSession,
  OraPlaybackOrchestrator,
  OraRuntime,
  createOpenAiTtsProvider,
} from "@arach/ora";

const runtime = new OraRuntime({
  providers: [createOpenAiTtsProvider()],
});

runtime.setCredentials("openai", {
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const session = new OraDocumentSession({
  text,
  paragraphLength: 280,
  voice: "alloy",
  preferences: {
    priority: "quality",
    delivery: "buffered",
  },
});

const orchestrator = new OraPlaybackOrchestrator({
  session: session.snapshot(),
});

await orchestrator.synthesizeUnit(runtime, {
  provider: "openai",
  index: 0,
  startLatencyMs: 180,
});

console.log(orchestrator.snapshot());
```

## OpenAI Audio

There is now a real OpenAI provider adapter in the package:

```ts
import { createOpenAiTtsProvider } from "@arach/ora";
```

Local examples:

- `bun run example:openai` writes one article excerpt to `.ora-output/openai-article-sample.mp3`
- `bun run example:openai-document` synthesizes the first two paragraph units from the book example
- `bun run example:orchestrator` prints the paragraph queue and playback handoff snapshot

The local site playground at `/playground` can also synthesize and play paragraph audio through the built-in OpenAI route when an `OPENAI_API_KEY` is available.

## Remote Worker

Ora can also talk to a remote worker over HTTP, which makes it practical to run
an open-source model on a separate machine such as a Tailscale-connected Mac Mini.

Start the bundled worker locally or on a remote host:

```bash
pnpm install
pnpm run build
node dist/worker-cli.js init --host 0.0.0.0 --port 4020 --token dev-secret
node dist/worker-cli.js serve --config .ora-worker/config.json
```

Register the remote worker as a provider:

```ts
import { createOraRuntime, createRemoteTtsProvider } from "@arach/ora";

const runtime = createOraRuntime({
  providers: [
    createRemoteTtsProvider({
      id: "mini",
      baseUrl: "http://mac-mini.tailnet.ts.net:4020",
      apiKey: process.env.ORA_REMOTE_TOKEN,
    }),
  ],
});

const response = await runtime.synthesize({
  provider: "mini",
  text: "Read this from the remote worker.",
  voice: "mock-voice",
});
```

Worker endpoints:

- `GET /health`
- `GET /v1/voices`
- `POST /v1/audio/speech`
- `POST /v1/audio/speech/stream`

The first worker backend is a mock transport backend so the local and remote flow
can be tested end-to-end before a native model runner is plugged in. Streaming
returns audio chunks and character boundary events so Ora can preserve the
existing tracking correctness ladder across the network boundary.

Structured docs:

- `docs/remote-worker.md`
- `docs/cookbook/system-macos.md`
- `docs/cookbook/kokoro-mlx-mac-mini.md`

## Notes

- Boundary-driven updates are authoritative.
- Estimated timelines are a fallback, not truth.
- Segment tracking stays generic: pass paragraphs, sentences, or any other ranges from the host app.
- Provider adapters stay transport-specific while Ora owns registry, credentials, and instrumentation.
- The current `0.1` path is OpenAI-first and paragraph-first.

## Development

```bash
bun install
bun run setup:local
bun run test
bun run check
bun run build
bun run docs:generate
bun run og:generate
bun run content:generate
bun run verify
bun run run:all
```

Local content commands:

- `bun run setup:local` installs `ora`, `og`, and `dewey-codex`, then builds the sibling tools.
- `bun run test` runs the Bun unit suite for tokenization, timeline generation, and playback tracking.
- `bun run tools:build` rebuilds the local `og` and `dewey-codex` checkouts without reinstalling.
- `bun run docs:generate` regenerates `AGENTS.md`, `llms.txt`, `docs.json`, and `install.md` via the local Dewey checkout.
- `bun run og:generate` regenerates `public/og.png` and the per-doc images from `og.config.json` via the local OG checkout.
- `bun run content:generate` runs both in order.
- `bun run site:docs` is a docs-generation alias.
- `bun run site` is the current content-generation alias for the future site pipeline.
- `bun run site:all` rebuilds the sibling tools, then regenerates docs and OG assets.
- `bun run site:dev` starts the local front-door proxy for the future site and docs dev servers.
- `bun run dev` aliases `bun run site:dev`.
- `bun run site:proxy` starts a local reverse proxy on `http://127.0.0.1:3100` and routes `/docs` to the docs server.
- `bun run verify` runs package typecheck, package build, and content generation.
- `bun run run:all` rebuilds the sibling tools first, then runs the full local verification flow.

There is still no `site/` app in `ora` yet. Until that exists, the dev gateway serves a local fallback homepage from repo metadata, docs pages from `docs.json`, and generated assets from `public/`, while still preferring real upstream site servers when they are available.

The proxy expects:

- `SITE_TARGET=http://127.0.0.1:3000` for the main site dev server
- `DOCS_TARGET=http://127.0.0.1:4321` for the docs-site dev server

Those are also the defaults if you do not set anything.
