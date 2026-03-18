import type {
  OraAudioFormat,
  OraRemoteTtsProviderOptions,
  OraSynthesisRequest,
  OraSynthesisResponse,
  OraSynthesisStreamEvent,
  OraTtsProvider,
  OraWorkerStreamEvent,
  OraWorkerSynthesisRequest,
  OraWorkerSynthesisResponse,
} from "../types";

function getFetch(options: OraRemoteTtsProviderOptions) {
  if (options.fetch) {
    return options.fetch;
  }

  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available in this runtime.");
  }

  return fetch;
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

function toBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function encodeRequest(request: OraSynthesisRequest): OraWorkerSynthesisRequest {
  return {
    text: request.text,
    voice: request.voice,
    rate: request.rate,
    instructions: request.instructions,
    format: request.format,
    metadata: request.metadata,
  };
}

function decodeBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Remote Ora TTS request failed with status ${response.status}.`;
  } catch {
    return `Remote Ora TTS request failed with status ${response.status}.`;
  }
}

async function* readNdjson(response: Response) {
  if (!response.body) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line) {
        yield JSON.parse(line) as OraWorkerStreamEvent;
      }

      newlineIndex = buffer.indexOf("\n");
    }

    if (done) {
      const trailing = buffer.trim();

      if (trailing) {
        yield JSON.parse(trailing) as OraWorkerStreamEvent;
      }

      break;
    }
  }
}

function toStreamEvent(event: OraWorkerStreamEvent): OraSynthesisStreamEvent {
  if (event.type === "audio") {
    return {
      type: "audio",
      audio: decodeBase64(event.audioBase64),
      mimeType: event.mimeType,
    };
  }

  if (event.type === "boundary" || event.type === "provider-mark") {
    return {
      type: event.type,
      charIndex: event.charIndex,
      timeMs: event.timeMs,
    };
  }

  if (event.type === "started") {
    return {
      type: "started",
      requestId: event.requestId,
      metadata: event.metadata,
    };
  }

  if (event.type === "metadata") {
    return {
      type: "metadata",
      metadata: event.metadata,
    };
  }

  if (event.type === "completed") {
    return {
      type: "completed",
      timeMs: event.timeMs,
      metadata: event.metadata,
    };
  }

  return {
    type: "metadata",
  };
}

export function createRemoteTtsProvider(
  options: OraRemoteTtsProviderOptions,
): OraTtsProvider {
  const fetchImpl = getFetch(options);
  const baseUrl = toBaseUrl(options.baseUrl);
  const providerId = options.id ?? "remote";

  return {
    id: providerId,
    async synthesize(request, context): Promise<OraSynthesisResponse> {
      const response = await fetchImpl(`${baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
        },
        body: JSON.stringify(encodeRequest(request)),
        signal: context.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const body = (await response.json()) as OraWorkerSynthesisResponse;

      return {
        requestId: context.requestId,
        cacheKey: body.cacheKey,
        provider: providerId,
        voice: body.voice,
        rate: body.rate,
        format: body.format,
        cached: body.cached,
        audioUrl: body.audioUrl ?? `${baseUrl}/v1/audio/speech/${body.requestId}`,
        audioData: body.audioBase64 ? decodeBase64(body.audioBase64) : undefined,
        mimeType: body.mimeType ?? resolveMimeType(body.format),
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: body.durationMs,
        metadata: body.metadata,
      };
    },
    async *stream(request, context): AsyncIterable<OraSynthesisStreamEvent> {
      const response = await fetchImpl(`${baseUrl}/v1/audio/speech/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}),
        },
        body: JSON.stringify(encodeRequest(request)),
        signal: context.signal,
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      for await (const event of readNdjson(response)) {
        yield toStreamEvent(event);
      }
    },
  };
}
