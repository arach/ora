# Remote Worker

Ora can talk to a text-to-speech worker running on another machine.

This is the right shape when:

- your main machine should stay light
- you want to keep a local model warm on a Mac Mini or similar host
- you want Ora to stay responsible for playback state while a remote node owns inference

## What Ora Owns

Ora owns the client and tracking surface:

- `createRemoteTtsProvider(...)`
- request normalization
- playback tracking and orchestration
- remote worker protocol

The worker owns:

- local model runtime
- voice inventory
- audio generation
- health reporting

## Worker Endpoints

The built-in worker currently exposes:

- `GET /health`
- `GET /v1/voices`
- `POST /v1/audio/speech`
- `POST /v1/audio/speech/stream`

## Built-In Worker CLI

Build the package and start the worker:

```bash
pnpm install
pnpm run build
node dist/worker-cli.js init --host 0.0.0.0 --port 4020 --token dev-secret
node dist/worker-cli.js serve --config .ora-worker/config.json
```

The default backend is a macOS system speech backend when available.

## Registering A Remote Provider

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
```

## Deployment Model

Ora should ship the stable worker contract and a few known-good recipes.

Model-specific installation remains cookbook-style on purpose.

That keeps the package support boundary clear:

- Ora supports the worker interface
- Ora documents known backend setups
- host-specific model troubleshooting stays in backend recipes

## Recipes

- [System macOS Backend](/Users/arach/dev/ora/docs/cookbook/system-macos.md)
- [Kokoro On Apple Silicon](/Users/arach/dev/ora/docs/cookbook/kokoro-mlx-mac-mini.md)

For MLX/Kokoro setups, the recommended deployment is:

1. run MLX Audio locally on the host
2. run Ora worker in `http` backend mode against that local MLX server
3. point Ora clients at the Ora worker, not directly at MLX Audio
