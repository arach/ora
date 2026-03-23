import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import { createServer } from "node:http";
import {
  createHttpOraWorkerBackend,
  OraMemoryCacheStore,
  createOraRuntime,
  createRemoteTtsProvider,
  createMockOraWorkerBackend,
  createOraWorkerServer,
} from "../src";

const servers: Array<ReturnType<typeof createOraWorkerServer>> = [];
const upstreams: Array<ReturnType<typeof createServer>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()?.close();
  }

  while (upstreams.length > 0) {
    await new Promise<void>((resolve) => upstreams.pop()?.close(() => resolve()));
  }
});

describe("createRemoteTtsProvider", () => {
  test("forwards preferences and resolved plans to the worker contract", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const runtime = createOraRuntime({
      providers: [
        createRemoteTtsProvider({
          id: "mini",
          baseUrl: "http://ora-worker.test",
          fetch: async (_input, init) => {
            requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);

            return new Response(
              JSON.stringify({
                requestId: "worker_req_1",
                cacheKey: "worker_cache_1",
                voice: "alloy",
                rate: 1,
                format: "mp3",
                cached: false,
                audio: {
                  base64: Buffer.from([1, 2, 3]).toString("base64"),
                  mimeType: "audio/mpeg",
                },
                durationMs: 120,
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                },
              },
            );
          },
        }),
      ],
    });

    const response = await runtime.synthesize({
      provider: "mini",
      text: "plan me",
      preferences: {
        priority: "quality",
      },
    });

    expect(requests[0]).toEqual({
      text: "plan me",
      format: "mp3",
      preferences: {
        priority: "quality",
      },
      plan: {
        priority: "quality",
        delivery: "buffered",
        format: "mp3",
        bitrateKbps: 192,
        sampleRateHz: 48_000,
        cacheStrategy: "full-audio",
      },
    });
    expect(response.audio).toEqual({
      data: new Uint8Array([1, 2, 3]),
      mimeType: "audio/mpeg",
    });
    expect(response.audioUrl).toBeUndefined();
  });

  test("lists voices through the worker", async () => {
    const server = createOraWorkerServer({
      backend: createMockOraWorkerBackend(),
      token: "secret",
    });
    servers.push(server);

    const { port } = await server.listen({ port: 4119 });
    const runtime = createOraRuntime({
      providers: [
        createRemoteTtsProvider({
          id: "mini",
          baseUrl: `http://127.0.0.1:${port}`,
          apiKey: "secret",
        }),
      ],
    });

    expect(await runtime.listVoices("mini")).toEqual([
      {
        id: "mock-voice",
        label: "Mock Voice",
        provider: "mini",
        tags: ["mock"],
        metadata: {
          upstreamProvider: "mock",
        },
      },
    ]);
  });

  test("synthesizes buffered audio through the worker", async () => {
    const server = createOraWorkerServer({
      backend: createMockOraWorkerBackend(),
      token: "secret",
    });
    servers.push(server);

    const { port } = await server.listen({ port: 4120 });
    const runtime = createOraRuntime({
      providers: [
        createRemoteTtsProvider({
          id: "mini",
          baseUrl: `http://127.0.0.1:${port}`,
          apiKey: "secret",
        }),
      ],
    });

    const response = await runtime.synthesize({
      provider: "mini",
      text: "Hello from the Mac mini",
      voice: "operator",
      format: "wav",
    });

    expect(response.provider).toBe("mini");
    expect(response.voice).toBe("operator");
    expect(response.audioData).toBeInstanceOf(Uint8Array);
    expect(response.audio?.data).toBeInstanceOf(Uint8Array);
    expect(response.audioUrl).toBeUndefined();
    expect(new TextDecoder().decode(response.audioData)).toContain("Hello from the Mac mini");
    expect(response.mimeType).toBe("audio/wav");
  });

  test("streams audio and boundary events through the worker", async () => {
    const server = createOraWorkerServer({
      backend: createMockOraWorkerBackend(),
      token: "secret",
    });
    servers.push(server);

    const { port } = await server.listen({ port: 4121 });
    const runtime = createOraRuntime({
      providers: [
        createRemoteTtsProvider({
          id: "mini",
          baseUrl: `http://127.0.0.1:${port}`,
          apiKey: "secret",
        }),
      ],
    });

    const events = [];

    for await (const event of runtime.stream({
      provider: "mini",
      text: "stream the words here",
      preferences: {
        priority: "responsiveness",
      },
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === "audio")).toBe(true);
    expect(events.some((event) => event.type === "boundary")).toBe(true);
    expect(events.at(-1)?.type).toBe("completed");
  });

  test("proxies synthesis through an upstream HTTP backend", async () => {
    const fixture = fs.readFileSync("/Users/arach/dev/ora/.ora-output/kokoro-remote.wav");
    const upstream = createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/v1/models") {
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            object: "list",
            data: [{ id: "mlx-community/Kokoro-82M-bf16" }],
          }),
        );
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/audio/speech") {
        response.setHeader("Content-Type", "audio/wav");
        response.end(fixture);
        return;
      }

      response.statusCode = 404;
      response.end();
    });
    upstreams.push(upstream);

    await new Promise<void>((resolve) => upstream.listen(4122, "127.0.0.1", () => resolve()));

    const server = createOraWorkerServer({
      backend: createHttpOraWorkerBackend({
        baseUrl: "http://127.0.0.1:4122",
      }),
    });
    servers.push(server);

    const { port } = await server.listen({ port: 4123 });
    const runtime = createOraRuntime({
      providers: [
        createRemoteTtsProvider({
          id: "mini",
          baseUrl: `http://127.0.0.1:${port}`,
        }),
      ],
    });

    const response = await runtime.synthesize({
      provider: "mini",
      text: "proxy me",
      voice: "af_heart",
      format: "wav",
    });

    expect(response.metadata?.backend).toBe("http");
    expect(response.audioData).toEqual(new Uint8Array(fixture));
  });

  test("preserves AIFF when the worker backend emits AIFF audio", async () => {
    const server = createOraWorkerServer({
      backend: {
        id: "system",
        listVoices() {
          return [{ id: "Samantha", label: "Samantha", provider: "system" }];
        },
        health() {
          return { ok: true };
        },
        async synthesize() {
          return {
            audio: {
              data: new Uint8Array([9, 8, 7]),
              mimeType: "audio/aiff",
            },
            voice: "Samantha",
            format: "aiff",
            durationMs: 240,
            cached: false,
          };
        },
      },
      token: "secret",
    });
    servers.push(server);

    const { port } = await server.listen({ port: 4124 });
    const runtime = createOraRuntime({
      providers: [
        createRemoteTtsProvider({
          id: "mini",
          baseUrl: `http://127.0.0.1:${port}`,
          apiKey: "secret",
        }),
      ],
    });

    const response = await runtime.synthesize({
      provider: "mini",
      text: "system voice",
      format: "wav",
    });

    expect(response.format).toBe("aiff");
    expect(response.mimeType).toBe("audio/aiff");
    expect(response.audio).toEqual({
      data: new Uint8Array([9, 8, 7]),
      mimeType: "audio/aiff",
    });
    expect(response.audioData).toEqual(new Uint8Array([9, 8, 7]));
  });

  test("queries and deletes worker cache entries over HTTP", async () => {
    let synthesizeCallCount = 0;
    const server = createOraWorkerServer({
      backend: {
        id: "mock",
        listVoices() {
          return [{ id: "mock-voice", label: "Mock Voice", provider: "mock" }];
        },
        health() {
          return { ok: true };
        },
        async synthesize() {
          synthesizeCallCount += 1;
          return {
            audio: {
              data: new Uint8Array([1, 2, 3, 4]),
              mimeType: "audio/mpeg",
            },
            voice: "mock-voice",
            format: "mp3",
            durationMs: 180,
            cached: false,
          };
        },
      },
      token: "secret",
      cacheStore: new OraMemoryCacheStore(),
    });
    servers.push(server);

    const { port } = await server.listen({ port: 4125 });
    const headers = {
      Authorization: "Bearer secret",
      "Content-Type": "application/json",
    };
    const synthesizeBody = {
      text: "cache me",
      format: "mp3",
    };

    const firstResponse = await fetch(`http://127.0.0.1:${port}/v1/audio/speech`, {
      method: "POST",
      headers,
      body: JSON.stringify(synthesizeBody),
    });
    const first = await firstResponse.json();

    const secondResponse = await fetch(`http://127.0.0.1:${port}/v1/audio/speech`, {
      method: "POST",
      headers,
      body: JSON.stringify(synthesizeBody),
    });
    const second = await secondResponse.json();

    expect(synthesizeCallCount).toBe(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);

    const listResponse = await fetch(`http://127.0.0.1:${port}/v1/cache?provider=mock`, {
      headers: {
        Authorization: "Bearer secret",
      },
    });
    const listBody = (await listResponse.json()) as {
      entries: Array<{ key: string; provider: string; hitCount: number; textLength: number }>;
    };

    expect(listBody.entries).toEqual([
      expect.objectContaining({
        key: first.cacheKey,
        provider: "mock",
        hitCount: 1,
        textLength: 8,
      }),
    ]);

    const entryResponse = await fetch(
      `http://127.0.0.1:${port}/v1/cache/${encodeURIComponent(first.cacheKey)}`,
      {
        headers: {
          Authorization: "Bearer secret",
        },
      },
    );
    const entry = (await entryResponse.json()) as {
      key: string;
      format: string;
      mimeType: string;
      hasAudioData: boolean;
    };

    expect(entry).toEqual(
      expect.objectContaining({
        key: first.cacheKey,
        format: "mp3",
        mimeType: "audio/mpeg",
        hasAudioData: true,
      }),
    );

    const deleteResponse = await fetch(
      `http://127.0.0.1:${port}/v1/cache/${encodeURIComponent(first.cacheKey)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: "Bearer secret",
        },
      },
    );
    const deleteBody = (await deleteResponse.json()) as { deleted: boolean };

    expect(deleteBody).toEqual({ deleted: true });
  });
});
