import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import { createServer } from "node:http";
import {
  createHttpOraWorkerBackend,
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
});
