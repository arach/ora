import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { tokenizeText } from "./tokenize";
import { createEstimatedTimeline } from "./timeline";
import type {
  OraAudioFormat,
  OraWorkerBackend,
  OraWorkerHealth,
  OraWorkerStreamEvent,
  OraWorkerSynthesisRequest,
  OraWorkerSynthesisResult,
  OraWorkerVoice,
} from "./types";

type OraWorkerConfig = {
  token?: string;
  host?: string;
  port?: number;
};

type OraWorkerServerOptions = {
  backend: OraWorkerBackend;
  token?: string;
};

export type OraWorkerServerHandle = {
  listen(options?: { host?: string; port?: number }): Promise<{ host: string; port: number }>;
  close(): Promise<void>;
  url(): string | null;
};

type OraSystemVoice = {
  id: string;
  locale?: string;
  sample?: string;
};

function toBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function resolveMimeType(format: OraAudioFormat) {
  switch (format) {
    case "wav":
      return "audio/wav";
    case "aac":
      return "audio/aac";
    case "opus":
      return "audio/opus";
    case "mp3":
    default:
      return "audio/mpeg";
  }
}

function createCacheKey(request: OraWorkerSynthesisRequest) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        text: request.text,
        voice: request.voice ?? "default",
        rate: request.rate ?? 1,
        format: request.format ?? "mp3",
        instructions: request.instructions ?? "",
      }),
    )
    .digest("hex");
}

async function execFile(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolveExec, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolveExec({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code}.`));
    });
  });
}

function parseSayVoices(output: string): OraSystemVoice[] {
  const voices: OraSystemVoice[] = [];

  for (const rawLine of output.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const match = line.match(/^(.+?)\s{2,}([a-z]{2}_[A-Z]{2})\s+#\s(.+)$/);

    if (!match) {
      continue;
    }

    voices.push({
      id: match[1]?.trim() ?? "",
      locale: match[2]?.trim(),
      sample: match[3]?.trim(),
    });
  }

  return voices;
}

async function getAudioDurationMs(path: string) {
  const { stdout } = await execFile("/usr/bin/afinfo", [path]);
  const match = stdout.match(/estimated duration:\s+([0-9.]+)\s+sec/i);

  if (!match) {
    return 0;
  }

  return Math.round(Number(match[1]) * 1000);
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
  }

  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return JSON.parse(bytes.toString("utf8")) as OraWorkerSynthesisRequest;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function isAuthorized(request: IncomingMessage, token: string | undefined) {
  if (!token) {
    return true;
  }

  return request.headers.authorization === `Bearer ${token}`;
}

async function writeNdjson(
  response: ServerResponse,
  stream: AsyncIterable<OraWorkerStreamEvent>,
) {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/x-ndjson");
  response.setHeader("Cache-Control", "no-store");

  for await (const event of stream) {
    response.write(`${JSON.stringify(event)}\n`);
  }

  response.end();
}

function normalizeResult(
  request: OraWorkerSynthesisRequest,
  result: OraWorkerSynthesisResult,
  requestId: string,
) {
  const format = request.format ?? "mp3";
  const audioData = result.audioData;

  return {
    requestId,
    cacheKey: createCacheKey(request),
    voice: request.voice ?? "default",
    rate: request.rate ?? 1,
    format,
    cached: result.cached ?? false,
    audioBase64: audioData ? toBase64(audioData) : undefined,
    audioUrl: result.audioUrl,
    mimeType: result.mimeType ?? resolveMimeType(format),
    durationMs: result.durationMs ?? 0,
    metadata: result.metadata,
  };
}

export function createMockOraWorkerBackend(options: {
  provider?: string;
  voice?: string;
} = {}): OraWorkerBackend {
  const voiceId = options.voice ?? "mock-voice";
  const voices: OraWorkerVoice[] = [{ id: voiceId, label: "Mock Voice" }];

  return {
    id: options.provider ?? "mock",
    listVoices() {
      return voices;
    },
    health() {
      return { ok: true };
    },
    async synthesize(request) {
      const format = request.format ?? "mp3";
      const payload = new TextEncoder().encode(
        `ORA_MOCK_AUDIO:${request.voice ?? voiceId}:${format}:${request.text}`,
      );

      return {
        audioData: payload,
        mimeType: resolveMimeType(format),
        durationMs: Math.max(320, request.text.length * 45),
        cached: false,
        metadata: {
          backend: "mock",
        },
      };
    },
    async *stream(request) {
      const requestId = randomUUID();
      const format = request.format ?? "mp3";
      const payload = new TextEncoder().encode(
        `ORA_MOCK_STREAM:${request.voice ?? voiceId}:${format}:${request.text}`,
      );
      const tokens = tokenizeText(request.text);
      const timeline = createEstimatedTimeline({
        text: request.text,
        tokens,
        durationMs: Math.max(320, request.text.length * 45),
      });
      const startedMetadata = {
        backend: "mock",
        voice: request.voice ?? voiceId,
        format,
      } satisfies Record<string, string | number | boolean | null>;
      const streamMetadata = {
        voice: request.voice ?? voiceId,
        format,
      } satisfies Record<string, string | number | boolean | null>;

      yield {
        type: "started",
        requestId,
        metadata: startedMetadata,
      } satisfies OraWorkerStreamEvent;

      yield {
        type: "metadata",
        metadata: streamMetadata,
      } satisfies OraWorkerStreamEvent;

      yield {
        type: "audio",
        audioBase64: toBase64(payload),
        mimeType: resolveMimeType(format),
      } satisfies OraWorkerStreamEvent;

      for (const token of timeline) {
        if (!token.isWord) {
          continue;
        }

        yield {
          type: "boundary",
          charIndex: token.start,
          timeMs: token.startMs,
        } satisfies OraWorkerStreamEvent;
      }

      yield {
        type: "completed",
        timeMs: timeline.at(-1)?.endMs ?? 0,
      } satisfies OraWorkerStreamEvent;
    },
  };
}

export function createSystemOraWorkerBackend(options: {
  defaultVoice?: string;
} = {}): OraWorkerBackend {
  let voiceCache: OraSystemVoice[] | null = null;

  async function listSystemVoices() {
    if (voiceCache) {
      return voiceCache;
    }

    const { stdout } = await execFile("/usr/bin/say", ["-v", "?"]);
    voiceCache = parseSayVoices(stdout);
    return voiceCache;
  }

  async function resolveVoice(requestedVoice?: string) {
    const voices = await listSystemVoices();

    if (requestedVoice && voices.some((voice) => voice.id === requestedVoice)) {
      return requestedVoice;
    }

    if (options.defaultVoice && voices.some((voice) => voice.id === options.defaultVoice)) {
      return options.defaultVoice;
    }

    return voices[0]?.id ?? "Samantha";
  }

  return {
    id: "system",
    async listVoices() {
      const voices = await listSystemVoices();
      return voices.map((voice) => ({
        id: voice.id,
        label: voice.locale ? `${voice.id} (${voice.locale})` : voice.id,
      }));
    },
    async health() {
      await execFile("/usr/bin/say", ["-v", "?"]);
      return { ok: true };
    },
    async synthesize(request) {
      const voice = await resolveVoice(request.voice);
      const filePath = resolve(tmpdir(), `ora-worker-${randomUUID()}.aiff`);
      await execFile("/usr/bin/say", ["-v", voice, "-o", filePath, request.text]);
      const audioData = new Uint8Array(await readFile(filePath));
      const durationMs = await getAudioDurationMs(filePath);

      return {
        audioData,
        mimeType: "audio/aiff",
        durationMs,
        cached: false,
        metadata: {
          backend: "system",
          voice,
        },
      };
    },
    async *stream(request) {
      const requestId = randomUUID();
      const voice = await resolveVoice(request.voice);
      const filePath = resolve(tmpdir(), `ora-worker-${randomUUID()}.aiff`);
      await execFile("/usr/bin/say", ["-v", voice, "-o", filePath, request.text]);
      const audioData = new Uint8Array(await readFile(filePath));
      const durationMs = await getAudioDurationMs(filePath);
      const tokens = tokenizeText(request.text);
      const timeline = createEstimatedTimeline({
        text: request.text,
        tokens,
        durationMs,
      });
      const startedMetadata = {
        backend: "system",
        voice,
        format: "aiff",
      } satisfies Record<string, string | number | boolean | null>;
      const streamMetadata = {
        voice,
        format: "aiff",
        durationMs,
      } satisfies Record<string, string | number | boolean | null>;
      const completedMetadata = {
        backend: "system",
        voice,
      } satisfies Record<string, string | number | boolean | null>;

      yield {
        type: "started",
        requestId,
        metadata: startedMetadata,
      } satisfies OraWorkerStreamEvent;

      yield {
        type: "metadata",
        metadata: streamMetadata,
      } satisfies OraWorkerStreamEvent;

      yield {
        type: "audio",
        audioBase64: toBase64(audioData),
        mimeType: "audio/aiff",
      } satisfies OraWorkerStreamEvent;

      for (const token of timeline) {
        if (!token.isWord) {
          continue;
        }

        yield {
          type: "boundary",
          charIndex: token.start,
          timeMs: token.startMs,
        } satisfies OraWorkerStreamEvent;
      }

      yield {
        type: "completed",
        timeMs: durationMs,
        metadata: completedMetadata,
      } satisfies OraWorkerStreamEvent;
    },
  };
}

export function createOraWorkerServer(
  options: OraWorkerServerOptions,
): OraWorkerServerHandle {
  let address: { host: string; port: number } | null = null;

  const server: Server = createServer(async (request, response) => {
    try {
      if (!isAuthorized(request, options.token)) {
        sendJson(response, 401, { error: "Unauthorized." });
        return;
      }

      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "GET" && url.pathname === "/health") {
        const voices = await options.backend.listVoices();
        const status = await options.backend.health();
        const body: OraWorkerHealth = {
          ok: status.ok,
          provider: options.backend.id,
          voices,
          capabilities: {
            streaming: Boolean(options.backend.stream),
            boundaries: Boolean(options.backend.stream),
          },
        };

        sendJson(response, 200, body);
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/voices") {
        sendJson(response, 200, {
          voices: await options.backend.listVoices(),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/audio/speech") {
        const body = await readJsonBody(request);
        const requestId = randomUUID();
        const result = await options.backend.synthesize(body);
        sendJson(response, 200, normalizeResult(body, result, requestId));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/audio/speech/stream") {
        if (!options.backend.stream) {
          sendJson(response, 501, { error: "Streaming is not implemented for this backend." });
          return;
        }

        const body = await readJsonBody(request);
        const stream = await options.backend.stream(body);
        await writeNdjson(response, stream);
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unknown Ora worker error.",
      });
    }
  });

  return {
    listen({ host = "127.0.0.1", port = 4020 } = {}) {
      return new Promise((resolveListen, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          address = { host, port };
          resolveListen(address);
        });
      });
    },
    close() {
      return new Promise((resolveClose, reject) => {
        if (!server.listening) {
          resolveClose();
          return;
        }

        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          address = null;
          resolveClose();
        });
      });
    },
    url() {
      return address ? `http://${address.host}:${address.port}` : null;
    },
  };
}

export async function readOraWorkerConfig(path: string): Promise<OraWorkerConfig> {
  const content = await readFile(path, "utf8");
  return JSON.parse(content) as OraWorkerConfig;
}

async function writeOraWorkerConfig(path: string, config: OraWorkerConfig) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function parseArgs(argv: string[]) {
  const command = argv[0] ?? "serve";
  const values = new Map<string, string>();

  for (let index = 1; index < argv.length; index += 1) {
    const entry = argv[index];

    if (!entry?.startsWith("--")) {
      continue;
    }

    const key = entry.slice(2);
    const value = argv[index + 1];

    if (value && !value.startsWith("--")) {
      values.set(key, value);
      index += 1;
    } else {
      values.set(key, "true");
    }
  }

  return { command, values };
}

export async function runOraWorkerCli(argv: string[]) {
  const { command, values } = parseArgs(argv);

  if (command === "init") {
    const configPath = resolve(values.get("config") ?? ".ora-worker/config.json");
    const token = values.get("token");
    const host = values.get("host") ?? "0.0.0.0";
    const port = Number(values.get("port") ?? "4020");

    await writeOraWorkerConfig(configPath, {
      token,
      host,
      port,
    });

    console.log(`ora-worker config written to ${configPath}`);
    return;
  }

  if (command !== "serve") {
    throw new Error(`Unknown ora-worker command "${command}".`);
  }

  const configPath = resolve(values.get("config") ?? ".ora-worker/config.json");
  let config: OraWorkerConfig = {};

  try {
    config = await readOraWorkerConfig(configPath);
  } catch {
    config = {};
  }

  const host = values.get("host") ?? config.host ?? "127.0.0.1";
  const port = Number(values.get("port") ?? String(config.port ?? 4020));
  const token = values.get("token") ?? config.token;
  const backendName = values.get("backend") ?? "system";
  const backend =
    backendName === "mock"
      ? createMockOraWorkerBackend({
          provider: values.get("provider") ?? "mock",
          voice: values.get("voice") ?? "mock-voice",
        })
      : createSystemOraWorkerBackend({
          defaultVoice: values.get("voice"),
        });
  const server = createOraWorkerServer({
    backend,
    token,
  });

  const address = await server.listen({ host, port });
  console.log(`ora-worker listening on http://${address.host}:${address.port}`);
}
