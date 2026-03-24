---
title: Quickstart
description: Get text-to-speech synthesis and voice discovery running quickly.
order: 2
group: Getting Started
---

## Install

```bash
bun add @arach/ora
```

Ora also works with `pnpm add @arach/ora` and `npm install @arach/ora`.

The published package includes:

- ESM and CommonJS entrypoints
- bundled TypeScript declarations
- the `ora-worker` CLI for worker-based deployments

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
