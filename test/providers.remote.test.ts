import { afterEach, describe, expect, test } from "bun:test";
import {
  createOraRuntime,
  createRemoteTtsProvider,
  createMockOraWorkerBackend,
  createOraWorkerServer,
} from "../src";

const servers: Array<ReturnType<typeof createOraWorkerServer>> = [];

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()?.close();
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
});
