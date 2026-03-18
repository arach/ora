import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type SpeechPriority = "quality" | "balanced" | "responsiveness";
type SpeechFormat = "mp3" | "wav" | "aac" | "opus";
type SpeechModel = "gpt-4o-mini-tts" | "tts-1" | "tts-1-hd";
type SpeechCacheMode = "use-cache" | "bypass-cache";

function parseEnvFile(path: string) {
  try {
    const raw = readFileSync(path, "utf8");
    const values: Record<string, string> = {};

    for (const line of raw.split("\n")) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...rest] = trimmed.split("=");
      values[key] = rest.join("=").trim();
    }

    return values;
  } catch {
    return {};
  }
}

export function resolveOpenAiApiKey() {
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  const repoEnv = parseEnvFile(resolve(process.cwd(), "..", ".env"));

  if (repoEnv.OPENAI_API_KEY) {
    return repoEnv.OPENAI_API_KEY;
  }

  const parentEnv = parseEnvFile(resolve(process.cwd(), "..", "..", ".env"));
  return parentEnv.OPENAI_API_KEY ?? "";
}

function getCacheDir() {
  const path = resolve(process.cwd(), ".ora-cache", "playground-speech");
  mkdirSync(path, { recursive: true });
  return path;
}

function createCacheKey(options: {
  text: string;
  voice?: string;
  format?: SpeechFormat;
  priority?: SpeechPriority;
  instructions?: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        text: options.text,
        voice: options.voice ?? "alloy",
        format: options.format ?? "mp3",
        priority: options.priority ?? "balanced",
        instructions: options.instructions ?? "",
      }),
    )
    .digest("hex");
}

function readCachedSpeech(cacheKey: string) {
  const path = resolve(getCacheDir(), `${cacheKey}.json`);

  if (!existsSync(path)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      model: SpeechModel;
      mimeType: string;
      data: string;
    };

    return {
      model: raw.model,
      mimeType: raw.mimeType,
      data: Uint8Array.from(Buffer.from(raw.data, "base64")),
      cache: "hit" as const,
    };
  } catch {
    return null;
  }
}

function writeCachedSpeech(
  cacheKey: string,
  value: { model: SpeechModel; mimeType: string; data: Uint8Array },
) {
  const path = resolve(getCacheDir(), `${cacheKey}.json`);
  writeFileSync(
    path,
    JSON.stringify({
      model: value.model,
      mimeType: value.mimeType,
      data: Buffer.from(value.data).toString("base64"),
    }),
  );
}

function resolveModel(priority: SpeechPriority, instructions?: string): SpeechModel {
  if (instructions) {
    return "gpt-4o-mini-tts";
  }

  if (priority === "responsiveness") {
    return "tts-1";
  }

  if (priority === "quality") {
    return "tts-1-hd";
  }

  return "gpt-4o-mini-tts";
}

export async function synthesizeOpenAiSpeech(options: {
  apiKey: string;
  text: string;
  voice?: string;
  format?: SpeechFormat;
  priority?: SpeechPriority;
  instructions?: string;
  cacheMode?: SpeechCacheMode;
}) {
  const cacheKey = createCacheKey(options);

  if (options.cacheMode !== "bypass-cache") {
    const cached = readCachedSpeech(cacheKey);

    if (cached) {
      return cached;
    }
  }

  const model = resolveModel(options.priority ?? "balanced", options.instructions);
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: options.text,
      voice: options.voice ?? "alloy",
      response_format: options.format ?? "mp3",
      instructions: options.instructions,
    }),
  });

  if (!response.ok) {
    let message = `OpenAI speech failed with status ${response.status}.`;

    try {
      const body = (await response.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // Keep fallback message.
    }

    throw new Error(message);
  }

  const value = {
    model,
    mimeType: response.headers.get("content-type") ?? "audio/mpeg",
    data: new Uint8Array(await response.arrayBuffer()),
    cache: "miss" as const,
  };

  if (options.cacheMode !== "bypass-cache") {
    writeCachedSpeech(cacheKey, value);
  }

  return value;
}
