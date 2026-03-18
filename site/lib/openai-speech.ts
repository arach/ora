import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type SpeechPriority = "quality" | "balanced" | "responsiveness";
type SpeechFormat = "mp3" | "wav" | "aac" | "opus";
type SpeechModel = "gpt-4o-mini-tts" | "tts-1" | "tts-1-hd";

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
}) {
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

  return {
    model,
    mimeType: response.headers.get("content-type") ?? "audio/mpeg",
    data: new Uint8Array(await response.arrayBuffer()),
  };
}
