import type {
  OraAudioFormat,
  OraSynthesisContext,
  OraSynthesisRequest,
  OraSynthesisResponse,
  OraSynthesisStreamEvent,
  OraTtsProvider,
} from "../types";

export type OraOpenAiSpeechModel = "gpt-4o-mini-tts" | "tts-1" | "tts-1-hd";

export type OraOpenAiTtsProviderOptions = {
  apiKey?: string;
  baseUrl?: string;
  defaultVoice?: string;
  fetch?: typeof fetch;
  model?: OraOpenAiSpeechModel;
};

type OpenAiSpeechRequest = {
  model: OraOpenAiSpeechModel;
  input: string;
  voice: string;
  instructions?: string;
  response_format?: OraAudioFormat;
  speed?: number;
};

function getFetch(options: OraOpenAiTtsProviderOptions) {
  if (options.fetch) {
    return options.fetch;
  }

  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available in this runtime.");
  }

  return fetch;
}

function resolveModel(
  request: OraSynthesisRequest,
  context: OraSynthesisContext,
  options: OraOpenAiTtsProviderOptions,
): OraOpenAiSpeechModel {
  if (options.model) {
    return options.model;
  }

  if (request.instructions) {
    return "gpt-4o-mini-tts";
  }

  if (context.plan.priority === "responsiveness") {
    return "tts-1";
  }

  if (context.plan.priority === "quality") {
    return "tts-1-hd";
  }

  return "gpt-4o-mini-tts";
}

function resolveApiKey(context: OraSynthesisContext, options: OraOpenAiTtsProviderOptions) {
  return options.apiKey ?? context.credentials.apiKey ?? "";
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

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `OpenAI TTS request failed with status ${response.status}.`;
  } catch {
    return `OpenAI TTS request failed with status ${response.status}.`;
  }
}

function buildRequestBody(
  request: OraSynthesisRequest,
  context: OraSynthesisContext,
  options: OraOpenAiTtsProviderOptions,
): OpenAiSpeechRequest {
  return {
    model: resolveModel(request, context, options),
    input: request.text,
    voice: request.voice ?? options.defaultVoice ?? "alloy",
    instructions: request.instructions,
    response_format: request.format ?? context.plan.format,
    speed: request.rate,
  };
}

function createCacheKey(body: OpenAiSpeechRequest) {
  return [
    "openai",
    body.model,
    body.voice,
    body.response_format ?? "mp3",
    body.speed ?? 1,
    body.input,
  ].join(":");
}

async function readAllBytes(response: Response) {
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export function createOpenAiTtsProvider(
  options: OraOpenAiTtsProviderOptions = {},
): OraTtsProvider {
  const fetchImpl = getFetch(options);
  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";

  return {
    id: "openai",
    async synthesize(request, context): Promise<OraSynthesisResponse> {
      const apiKey = resolveApiKey(context, options);

      if (!apiKey) {
        throw new Error("OpenAI TTS requires an apiKey credential.");
      }

      const body = buildRequestBody(request, context, options);
      const response = await fetchImpl(`${baseUrl}/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: context.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const audioData = await readAllBytes(response);
      const format = body.response_format ?? "mp3";

      return {
        requestId: context.requestId,
        cacheKey: createCacheKey(body),
        provider: "openai",
        voice: body.voice,
        rate: body.speed ?? 1,
        format,
        cached: false,
        audioUrl: `openai://audio/${context.requestId}`,
        audioData,
        mimeType: resolveMimeType(format),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        metadata: {
          model: body.model,
        },
      };
    },
    async *stream(request, context): AsyncIterable<OraSynthesisStreamEvent> {
      const apiKey = resolveApiKey(context, options);

      if (!apiKey) {
        throw new Error("OpenAI TTS requires an apiKey credential.");
      }

      const body = buildRequestBody(request, context, options);
      const response = await fetchImpl(`${baseUrl}/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: context.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      yield {
        type: "metadata",
        metadata: {
          model: body.model,
          voice: body.voice,
          format: body.response_format ?? "mp3",
        },
      };

      if (!response.body) {
        const audioData = await readAllBytes(response);
        yield {
          type: "audio",
          audio: audioData,
          mimeType: resolveMimeType(body.response_format ?? "mp3"),
        };
        return;
      }

      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        if (value) {
          yield {
            type: "audio",
            audio: value,
            mimeType: resolveMimeType(body.response_format ?? "mp3"),
          };
        }
      }
    },
  };
}
