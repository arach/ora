import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { tokenizeText } from "./tokenize";
import { createEstimatedTimeline } from "./timeline";
import type {
  OraAudioAsset,
  OraAudioFormat,
  OraCacheQuery,
  OraCacheStore,
  OraCachedSynthesisRecord,
  OraHttpWorkerBackendOptions,
  OraSynthesisResponse,
  OraWorkerBackend,
  OraWorkerAudioAsset,
  OraWorkerHealth,
  OraWorkerStreamEvent,
  OraWorkerSynthesisRequest,
  OraWorkerSynthesisResponse,
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
  cacheStore?: OraCacheStore;
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
    case "aiff":
      return "audio/aiff";
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

function getFetch(fetchImpl?: typeof fetch) {
  if (fetchImpl) {
    return fetchImpl;
  }

  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available in this runtime.");
  }

  return fetch;
}

function createCacheKey(request: OraWorkerSynthesisRequest) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        text: request.text,
        voice: request.voice ?? "default",
        rate: request.rate ?? 1,
        format: request.format ?? request.plan?.format ?? "mp3",
        instructions: request.instructions ?? "",
      }),
    )
    .digest("hex");
}

function createTextHash(text: string) {
  return createHash("sha256").update(text).digest("hex");
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
): OraWorkerSynthesisResponse {
  const format = result.format ?? request.format ?? request.plan?.format ?? "mp3";
  const audioData = result.audio?.data ?? result.audioData;
  const audioUrl = result.audio?.url ?? result.audioUrl;
  const mimeType = result.audio?.mimeType ?? result.mimeType ?? resolveMimeType(format);
  const audio: OraWorkerAudioAsset | undefined =
    audioData || audioUrl || mimeType
      ? {
          ...(audioData ? { base64: toBase64(audioData) } : {}),
          ...(audioUrl ? { url: audioUrl } : {}),
          ...(mimeType ? { mimeType } : {}),
        }
      : undefined;

  return {
    requestId,
    cacheKey: createCacheKey(request),
    voice: result.voice ?? request.voice ?? "default",
    rate: result.rate ?? request.rate ?? 1,
    format,
    cached: result.cached ?? false,
    ...(audio ? { audio } : {}),
    ...(audio?.base64 ? { audioBase64: audio.base64 } : {}),
    ...(audio?.url ? { audioUrl: audio.url } : {}),
    ...(audio?.mimeType ? { mimeType: audio.mimeType } : {}),
    durationMs: result.durationMs ?? 0,
    metadata: result.metadata,
  };
}

function createRuntimeCacheRecord(
  backendId: string,
  request: OraWorkerSynthesisRequest,
  result: OraWorkerSynthesisResult,
  response: OraWorkerSynthesisResponse,
): OraCachedSynthesisRecord {
  const timestamp = new Date().toISOString();
  const audioData = result.audio?.data ?? result.audioData;
  const audioUrl = result.audio?.url ?? result.audioUrl;
  const mimeType = result.audio?.mimeType ?? result.mimeType ?? response.mimeType;
  const normalizedResponse: OraSynthesisResponse = {
    requestId: response.requestId,
    cacheKey: response.cacheKey,
    provider: backendId,
    voice: response.voice,
    rate: response.rate,
    format: response.format,
    cached: false,
    ...(audioData || audioUrl || mimeType
      ? {
          audio: {
            ...(audioData ? { data: audioData } : {}),
            ...(audioUrl ? { url: audioUrl } : {}),
            ...(mimeType ? { mimeType } : {}),
          },
        }
      : {}),
    ...(audioData ? { audioData } : {}),
    ...(audioUrl ? { audioUrl } : {}),
    ...(mimeType ? { mimeType } : {}),
    startedAt: timestamp,
    completedAt: timestamp,
    durationMs: response.durationMs,
    metadata: response.metadata,
  };

  return {
    entry: {
      key: response.cacheKey,
      provider: backendId,
      voice: response.voice,
      format: response.format,
      textHash: createTextHash(request.text),
      textLength: request.text.length,
      durationMs: response.durationMs,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastAccessedAt: timestamp,
      hitCount: 0,
      cached: true,
      hasAudioData: Boolean(audioData),
      ...(audioUrl ? { audioUrl } : {}),
      ...(mimeType ? { mimeType } : {}),
      ...(response.metadata ? { metadata: response.metadata } : {}),
    },
    response: normalizedResponse,
  };
}

function toWorkerResponseFromCache(
  record: OraCachedSynthesisRecord,
  requestId: string,
): OraWorkerSynthesisResponse {
  const audioData = record.response.audio?.data ?? record.response.audioData;
  const audioUrl = record.response.audio?.url ?? record.response.audioUrl;
  const mimeType = record.response.audio?.mimeType ?? record.response.mimeType;
  const audio: OraWorkerAudioAsset | undefined =
    audioData || audioUrl || mimeType
      ? {
          ...(audioData ? { base64: toBase64(audioData) } : {}),
          ...(audioUrl ? { url: audioUrl } : {}),
          ...(mimeType ? { mimeType } : {}),
        }
      : undefined;

  return {
    requestId,
    cacheKey: record.entry.key,
    voice: record.entry.voice,
    rate: record.response.rate,
    format: record.entry.format,
    cached: true,
    ...(audio ? { audio } : {}),
    ...(audio?.base64 ? { audioBase64: audio.base64 } : {}),
    ...(audio?.url ? { audioUrl: audio.url } : {}),
    ...(audio?.mimeType ? { mimeType: audio.mimeType } : {}),
    durationMs: record.entry.durationMs,
    metadata: record.response.metadata,
  };
}

function parseCacheQuery(url: URL): OraCacheQuery {
  const limit = url.searchParams.get("limit");

  return {
    ...(url.searchParams.get("provider") ? { provider: url.searchParams.get("provider") ?? "" } : {}),
    ...(url.searchParams.get("voice") ? { voice: url.searchParams.get("voice") ?? "" } : {}),
    ...(url.searchParams.get("format")
      ? { format: url.searchParams.get("format") as OraAudioFormat }
      : {}),
    ...(url.searchParams.get("textHash") ? { textHash: url.searchParams.get("textHash") ?? "" } : {}),
    ...(limit ? { limit: Number(limit) } : {}),
  };
}

export function createMockOraWorkerBackend(options: {
  provider?: string;
  voice?: string;
} = {}): OraWorkerBackend {
  const providerId = options.provider ?? "mock";
  const voiceId = options.voice ?? "mock-voice";
  const voices: OraWorkerVoice[] = [
    { id: voiceId, label: "Mock Voice", provider: providerId, tags: ["mock"] },
  ];

  return {
    id: providerId,
    listVoices() {
      return voices;
    },
    health() {
      return { ok: true };
    },
    async synthesize(request) {
      const format = request.format ?? request.plan?.format ?? "mp3";
      const payload = new TextEncoder().encode(
        `ORA_MOCK_AUDIO:${request.voice ?? voiceId}:${format}:${request.text}`,
      );

      return {
        audio: {
          data: payload,
          mimeType: resolveMimeType(format),
        } satisfies OraAudioAsset,
        audioData: payload,
        voice: request.voice ?? voiceId,
        format,
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
      const format = request.format ?? request.plan?.format ?? "mp3";
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

export function createHttpOraWorkerBackend(
  options: OraHttpWorkerBackendOptions,
): OraWorkerBackend {
  const fetchImpl = getFetch(options.fetch);
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const model = options.model ?? "mlx-community/Kokoro-82M-bf16";
  const defaultVoice = options.voice ?? "af_heart";
  const langCode = options.langCode ?? "a";

  return {
    id: options.id ?? "http",
    async listVoices() {
      return [
        {
          id: defaultVoice,
          label: `${defaultVoice} (${model})`,
          provider: options.id ?? "http",
          tags: ["default"],
          metadata: {
            model,
          },
        },
      ];
    },
    async health() {
      const response = await fetchImpl(`${baseUrl}/v1/models`);
      return { ok: response.ok };
    },
    async synthesize(request) {
      const format = request.format ?? request.plan?.format ?? "wav";
      const response = await fetchImpl(`${baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: request.text,
          voice: request.voice ?? defaultVoice,
          lang_code: langCode,
          speed: request.rate ?? 1,
          response_format: format,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP worker backend failed with status ${response.status}.`);
      }

      const audioData = new Uint8Array(await response.arrayBuffer());
      const filePath = resolve(tmpdir(), `ora-worker-proxy-${randomUUID()}.wav`);
      await writeFile(filePath, audioData);
      const durationMs = await getAudioDurationMs(filePath);

      return {
        audio: {
          data: audioData,
          mimeType: response.headers.get("content-type") ?? "audio/wav",
        } satisfies OraAudioAsset,
        audioData,
        voice: request.voice ?? defaultVoice,
        format,
        mimeType: response.headers.get("content-type") ?? "audio/wav",
        durationMs,
        cached: false,
        metadata: {
          backend: "http",
          model,
          voice: request.voice ?? defaultVoice,
          upstream: baseUrl,
        },
      };
    },
    async *stream(request) {
      const requestId = randomUUID();
      const result = await this.synthesize(request);
      const tokens = tokenizeText(request.text);
      const timeline = createEstimatedTimeline({
        text: request.text,
        tokens,
        durationMs: result.durationMs ?? Math.max(320, request.text.length * 45),
      });

      yield {
        type: "started",
        requestId,
        metadata: {
          backend: "http",
          model,
          voice: request.voice ?? defaultVoice,
        },
      } satisfies OraWorkerStreamEvent;

      yield {
        type: "audio",
        audioBase64: toBase64(result.audioData ?? new Uint8Array()),
        mimeType: result.mimeType,
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
        timeMs: result.durationMs,
        metadata: result.metadata,
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
        provider: "system",
        locale: voice.locale?.replace("_", "-"),
        previewText: voice.sample,
        metadata: {
          sample: voice.sample ?? null,
        },
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
        audio: {
          data: audioData,
          mimeType: "audio/aiff",
        } satisfies OraAudioAsset,
        audioData,
        voice,
        format: "aiff",
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

      if (request.method === "GET" && url.pathname === "/v1/cache") {
        if (!options.cacheStore) {
          sendJson(response, 501, { error: "Cache is not configured for this worker." });
          return;
        }

        sendJson(response, 200, {
          entries: await options.cacheStore.list(parseCacheQuery(url)),
        });
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/v1/cache/")) {
        if (!options.cacheStore) {
          sendJson(response, 501, { error: "Cache is not configured for this worker." });
          return;
        }

        const key = decodeURIComponent(url.pathname.slice("/v1/cache/".length));
        const record = await options.cacheStore.peek(key);

        if (!record) {
          sendJson(response, 404, { error: "Cache entry not found." });
          return;
        }

        sendJson(response, 200, record.entry);
        return;
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/v1/cache/")) {
        if (!options.cacheStore) {
          sendJson(response, 501, { error: "Cache is not configured for this worker." });
          return;
        }

        const key = decodeURIComponent(url.pathname.slice("/v1/cache/".length));
        sendJson(response, 200, { deleted: await options.cacheStore.delete(key) });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/audio/speech") {
        const body = await readJsonBody(request);
        const cacheKey = createCacheKey(body);

        if (options.cacheStore) {
          const cachedRecord = await options.cacheStore.get(cacheKey);

          if (cachedRecord) {
            sendJson(response, 200, toWorkerResponseFromCache(cachedRecord, randomUUID()));
            return;
          }
        }

        const requestId = randomUUID();
        const result = await options.backend.synthesize(body);
        const normalized = normalizeResult(body, result, requestId);

        if (options.cacheStore) {
          await options.cacheStore.set(
            createRuntimeCacheRecord(options.backend.id, body, result, normalized),
          );
        }

        sendJson(response, 200, normalized);
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
      : backendName === "http"
        ? createHttpOraWorkerBackend({
            id: values.get("provider") ?? "http",
            baseUrl: values.get("upstream") ?? "http://127.0.0.1:4022",
            model: values.get("model") ?? "mlx-community/Kokoro-82M-bf16",
            voice: values.get("voice") ?? "af_heart",
            langCode: values.get("lang") ?? "a",
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
