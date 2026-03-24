"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  OraBufferedInstrumentationSink: () => OraBufferedInstrumentationSink,
  OraDocumentSession: () => OraDocumentSession,
  OraMemoryCacheStore: () => OraMemoryCacheStore,
  OraMemoryCredentialStore: () => OraMemoryCredentialStore,
  OraPlaybackOrchestrator: () => OraPlaybackOrchestrator,
  OraPlaybackTracker: () => OraPlaybackTracker,
  OraRuntime: () => OraRuntime,
  createEstimatedTimeline: () => createEstimatedTimeline,
  createHttpOraWorkerBackend: () => createHttpOraWorkerBackend,
  createMockOraWorkerBackend: () => createMockOraWorkerBackend,
  createOpenAiTtsProvider: () => createOpenAiTtsProvider,
  createOraDocumentSession: () => createOraDocumentSession,
  createOraPlaybackOrchestrator: () => createOraPlaybackOrchestrator,
  createOraRuntime: () => createOraRuntime,
  createOraWorkerServer: () => createOraWorkerServer,
  createRemoteTtsProvider: () => createRemoteTtsProvider,
  createSegmentsFromParagraphs: () => createSegmentsFromParagraphs,
  findCorpusEntryByKind: () => findCorpusEntryByKind,
  findTimedTokenAtTime: () => findTimedTokenAtTime,
  findTokenAtCharIndex: () => findTokenAtCharIndex,
  oraCorpus: () => oraCorpus,
  readOraWorkerConfig: () => readOraWorkerConfig,
  resolveSynthesisPlan: () => resolveSynthesisPlan,
  splitTextIntoParagraphs: () => splitTextIntoParagraphs,
  tokenizeText: () => tokenizeText
});
module.exports = __toCommonJS(index_exports);

// src/cache.ts
function cloneBytes(bytes) {
  return bytes ? new Uint8Array(bytes) : void 0;
}
function cloneAudio(audio) {
  if (!audio) {
    return void 0;
  }
  return {
    ...audio.data ? { data: cloneBytes(audio.data) } : {},
    ...audio.url ? { url: audio.url } : {},
    ...audio.mimeType ? { mimeType: audio.mimeType } : {}
  };
}
function cloneResponse(response) {
  return {
    ...response,
    ...response.audio ? { audio: cloneAudio(response.audio) } : {},
    ...response.audioData ? { audioData: cloneBytes(response.audioData) } : {},
    ...response.metadata ? { metadata: { ...response.metadata } } : {}
  };
}
function cloneEntry(entry) {
  return {
    ...entry,
    ...entry.metadata ? { metadata: { ...entry.metadata } } : {}
  };
}
function cloneRecord(record) {
  return {
    entry: cloneEntry(record.entry),
    response: cloneResponse(record.response)
  };
}
var OraMemoryCacheStore = class {
  values = /* @__PURE__ */ new Map();
  get(key) {
    const record = this.values.get(key);
    if (!record) {
      return void 0;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const nextRecord = {
      entry: {
        ...record.entry,
        hitCount: record.entry.hitCount + 1,
        lastAccessedAt: now,
        updatedAt: now
      },
      response: cloneResponse(record.response)
    };
    this.values.set(key, nextRecord);
    return cloneRecord(nextRecord);
  }
  peek(key) {
    const record = this.values.get(key);
    return record ? cloneRecord(record) : void 0;
  }
  set(record) {
    this.values.set(record.entry.key, cloneRecord(record));
  }
  delete(key) {
    return this.values.delete(key);
  }
  list(query = {}) {
    const entries = [...this.values.values()].map((record) => cloneEntry(record.entry));
    const filtered = entries.filter((entry) => {
      if (query.provider && entry.provider !== query.provider) {
        return false;
      }
      if (query.voice && entry.voice !== query.voice) {
        return false;
      }
      if (query.format && entry.format !== query.format) {
        return false;
      }
      if (query.textHash && entry.textHash !== query.textHash) {
        return false;
      }
      return true;
    });
    filtered.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    if (query.limit && query.limit > 0) {
      return filtered.slice(0, query.limit);
    }
    return filtered;
  }
};

// src/credentials.ts
var OraMemoryCredentialStore = class {
  values = /* @__PURE__ */ new Map();
  get(provider) {
    const credentials = this.values.get(provider);
    return credentials ? { ...credentials } : void 0;
  }
  set(provider, credentials) {
    this.values.set(provider, { ...credentials });
  }
  delete(provider) {
    return this.values.delete(provider);
  }
  has(provider) {
    return this.values.has(provider);
  }
  providers() {
    return [...this.values.keys()];
  }
};

// src/instrumentation.ts
var OraBufferedInstrumentationSink = class {
  events = [];
  emit(event) {
    this.events.push(event);
  }
  flush() {
    return [...this.events];
  }
  reset() {
    this.events.length = 0;
  }
};

// src/corpus.ts
var oraCorpus = [
  {
    id: "interpretable-ai-text-detection",
    kind: "article",
    sourceFile: "2603.15034v1.pdf",
    excerpt: "Tasks of machine-generated text detection and attribution increasingly appear in the form of shared tasks, such as SemEval, AuTexTification, or RuATD. Within AuTexTification 2023, the system by Przybyla et al. introduced an architecture that combined transformer-based embeddings, probabilistic features derived from language models, and traditional linguistic statistics. This approach improved performance, but it had some limitations."
  },
  {
    id: "diagnostic-interview-for-narcissistic-patients",
    kind: "article",
    sourceFile: "ArcGenPsychDINGundersonRonningstametal1990.pdf",
    excerpt: "This report describes the content and development of a semistructured interview, the Diagnostic Interview for Narcissism. The interview evaluates 33 features of pathological narcissism covering five domains of function: grandiosity, interpersonal relations, reactiveness, affects and moods, and social and moral adaptation. Its utility is established by reliability studies and by developing a scoring system from a sample of prototypic narcissistic patients who were compared with others."
  },
  {
    id: "state-of-ai-2023",
    kind: "white-paper",
    sourceFile: "State of AI Report 2023 - ONLINE.pdf",
    excerpt: "Artificial intelligence is a multidisciplinary field of science and engineering whose goal is to create intelligent machines. We believe that AI will be a force multiplier on technological progress in our increasingly digital, data-driven world. This is because everything around us today, ranging from culture to consumer products, is a product of intelligence. The State of AI Report is a compilation of the most interesting things we have seen with a goal of triggering an informed conversation about the state of AI and its implication for the future."
  },
  {
    id: "oprah-winfrey-and-the-glamour-of-misery",
    kind: "book",
    sourceFile: "Eva Illouz - Oprah Winfrey and the Glamour of Misery_ An Essay on Popular Culture-Columbia University Press (2003).pdf",
    excerpt: "The Oprah Winfrey Show has become a text of breathtaking proportions, stretching from the United States to India, Europe, Africa, and Asia. It is remarkable not only for the variety of issues it addresses, the scope of its influence, and the size of its audience, but also because few global media empires are the outcome of one person's single-handed enterprise. This is not to deny that the shrewd and aggressive marketing strategies of the King Corporation have played an important role in helping Oprah gain the upper hand in the market. But her success has been so swift, significant, and durable that the economic explanation alone will not do."
  },
  {
    id: "the-end-of-love",
    kind: "book",
    sourceFile: "Eva Illouz - The End of Love_ A Sociology of Negative Relations-Oxford University Press (2019).pdf",
    excerpt: "Western culture has endlessly represented the ways in which love miraculously erupts in people's lives, the mythical moment in which one knows someone is destined to us, the feverish waiting for a phone call or an email, and the thrill that runs our spine at the mere thought of another person. Yet a culture that has so much to say about love is far more silent on the no-less-mysterious moment when we avoid falling in love, when we fall out of love, or when the one who kept us awake at night now leaves us indifferent. This silence is all the more puzzling because the number of relationships that dissolve soon after their beginning is staggering."
  }
];
function findCorpusEntryByKind(kind) {
  return oraCorpus.find((entry) => entry.kind === kind) ?? null;
}

// src/providers/openai.ts
var OPENAI_VOICES = [
  { id: "alloy", label: "Alloy", provider: "openai", tags: ["neutral"], metadata: { source: "static-catalog" } },
  { id: "ash", label: "Ash", provider: "openai", tags: ["conversational"], metadata: { source: "static-catalog" } },
  { id: "ballad", label: "Ballad", provider: "openai", tags: ["warm"], metadata: { source: "static-catalog" } },
  { id: "coral", label: "Coral", provider: "openai", tags: ["bright"], metadata: { source: "static-catalog" } },
  { id: "echo", label: "Echo", provider: "openai", tags: ["clear"], metadata: { source: "static-catalog" } },
  { id: "fable", label: "Fable", provider: "openai", tags: ["expressive"], metadata: { source: "static-catalog" } },
  { id: "nova", label: "Nova", provider: "openai", tags: ["versatile"], metadata: { source: "static-catalog" } },
  { id: "onyx", label: "Onyx", provider: "openai", tags: ["deep"], metadata: { source: "static-catalog" } },
  { id: "sage", label: "Sage", provider: "openai", tags: ["calm"], metadata: { source: "static-catalog" } },
  { id: "shimmer", label: "Shimmer", provider: "openai", tags: ["bright"], metadata: { source: "static-catalog" } },
  { id: "verse", label: "Verse", provider: "openai", tags: ["narrative"], metadata: { source: "static-catalog" } }
];
function getFetch(options) {
  if (options.fetch) {
    return options.fetch;
  }
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available in this runtime.");
  }
  return fetch;
}
function resolveModel(request, context, options) {
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
function resolveApiKey(context, options) {
  return options.apiKey ?? context.credentials.apiKey ?? "";
}
function resolveMimeType(format) {
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
async function readErrorMessage(response) {
  try {
    const body = await response.json();
    return body.error?.message ?? `OpenAI TTS request failed with status ${response.status}.`;
  } catch {
    return `OpenAI TTS request failed with status ${response.status}.`;
  }
}
function buildRequestBody(request, context, options) {
  return {
    model: resolveModel(request, context, options),
    input: request.text,
    voice: request.voice ?? options.defaultVoice ?? "alloy",
    instructions: request.instructions,
    response_format: request.format ?? context.plan.format,
    speed: request.rate
  };
}
function createCacheKey(body) {
  return [
    "openai",
    body.model,
    body.voice,
    body.response_format ?? "mp3",
    body.speed ?? 1,
    body.input
  ].join(":");
}
async function readAllBytes(response) {
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}
function createOpenAiTtsProvider(options = {}) {
  const fetchImpl = getFetch(options);
  const baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
  const voices = options.voices ?? OPENAI_VOICES;
  return {
    id: "openai",
    label: "OpenAI",
    async listVoices() {
      return voices.map((voice) => ({
        ...voice,
        provider: voice.provider ?? "openai",
        label: voice.label || voice.id
      }));
    },
    getCacheKey(request, context) {
      return createCacheKey(buildRequestBody(request, context, options));
    },
    async synthesize(request, context) {
      const apiKey = resolveApiKey(context, options);
      if (!apiKey) {
        throw new Error("OpenAI TTS requires an apiKey credential.");
      }
      const body = buildRequestBody(request, context, options);
      const response = await fetchImpl(`${baseUrl}/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: context.signal
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
        audio: {
          data: audioData,
          mimeType: resolveMimeType(format)
        },
        audioData,
        mimeType: resolveMimeType(format),
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        durationMs: 0,
        metadata: {
          model: body.model
        }
      };
    },
    async *stream(request, context) {
      const apiKey = resolveApiKey(context, options);
      if (!apiKey) {
        throw new Error("OpenAI TTS requires an apiKey credential.");
      }
      const body = buildRequestBody(request, context, options);
      const response = await fetchImpl(`${baseUrl}/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: context.signal
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      yield {
        type: "metadata",
        metadata: {
          model: body.model,
          voice: body.voice,
          format: body.response_format ?? "mp3"
        }
      };
      if (!response.body) {
        const audioData = await readAllBytes(response);
        yield {
          type: "audio",
          audio: audioData,
          mimeType: resolveMimeType(body.response_format ?? "mp3")
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
            mimeType: resolveMimeType(body.response_format ?? "mp3")
          };
        }
      }
    }
  };
}

// src/hash.ts
async function createDigest(value) {
  const bytes = new TextEncoder().encode(value);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `ora-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

// src/providers/remote.ts
function getFetch2(options) {
  if (options.fetch) {
    return options.fetch;
  }
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available in this runtime.");
  }
  return fetch;
}
function resolveMimeType2(format) {
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
function toBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}
function encodeRequest(request) {
  return {
    text: request.text,
    voice: request.voice,
    rate: request.rate,
    instructions: request.instructions,
    format: request.format,
    preferences: request.preferences,
    metadata: request.metadata
  };
}
function encodeWorkerRequest(request, options) {
  return {
    ...encodeRequest(request),
    format: request.format ?? options.format,
    preferences: options.preferences,
    plan: options.plan
  };
}
async function createRemoteCacheKey(providerId, request) {
  const digest = await createDigest(JSON.stringify(request));
  return `${providerId}:${digest}`;
}
function decodeBase64(value) {
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
async function readErrorMessage2(response) {
  try {
    const body = await response.json();
    return body.error ?? `Remote Ora TTS request failed with status ${response.status}.`;
  } catch {
    return `Remote Ora TTS request failed with status ${response.status}.`;
  }
}
async function* readNdjson(response) {
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
        yield JSON.parse(line);
      }
      newlineIndex = buffer.indexOf("\n");
    }
    if (done) {
      const trailing = buffer.trim();
      if (trailing) {
        yield JSON.parse(trailing);
      }
      break;
    }
  }
}
function toStreamEvent(event) {
  if (event.type === "audio") {
    return {
      type: "audio",
      audio: decodeBase64(event.audioBase64),
      mimeType: event.mimeType
    };
  }
  if (event.type === "boundary" || event.type === "provider-mark") {
    return {
      type: event.type,
      charIndex: event.charIndex,
      timeMs: event.timeMs
    };
  }
  if (event.type === "started") {
    return {
      type: "started",
      requestId: event.requestId,
      metadata: event.metadata
    };
  }
  if (event.type === "metadata") {
    return {
      type: "metadata",
      metadata: event.metadata
    };
  }
  if (event.type === "completed") {
    return {
      type: "completed",
      timeMs: event.timeMs,
      metadata: event.metadata
    };
  }
  return {
    type: "metadata"
  };
}
function decodeAudio(body) {
  const data = body.audio?.base64 ? decodeBase64(body.audio.base64) : body.audioBase64 ? decodeBase64(body.audioBase64) : void 0;
  const url = body.audio?.url ?? body.audioUrl;
  const mimeType = body.audio?.mimeType ?? body.mimeType ?? resolveMimeType2(body.format);
  if (!data && !url && !mimeType) {
    return void 0;
  }
  return {
    ...data ? { data } : {},
    ...url ? { url } : {},
    ...mimeType ? { mimeType } : {}
  };
}
function createRemoteTtsProvider(options) {
  const fetchImpl = getFetch2(options);
  const baseUrl = toBaseUrl(options.baseUrl);
  const providerId = options.id ?? "remote";
  return {
    id: providerId,
    label: String(providerId),
    async listVoices() {
      const response = await fetchImpl(`${baseUrl}/v1/voices`, {
        headers: {
          ...options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}
        }
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage2(response));
      }
      const body = await response.json();
      return (body.voices ?? []).map((voice) => ({
        ...voice,
        provider: providerId,
        label: voice.label || voice.id,
        metadata: {
          ...voice.metadata,
          upstreamProvider: voice.provider ?? null
        }
      }));
    },
    getCacheKey(request, context) {
      return createRemoteCacheKey(
        providerId,
        encodeWorkerRequest(request, {
          format: context.plan.format,
          preferences: request.preferences,
          plan: context.plan
        })
      );
    },
    async synthesize(request, context) {
      const encodedRequest = encodeWorkerRequest(request, {
        format: context.plan.format,
        preferences: request.preferences,
        plan: context.plan
      });
      const response = await fetchImpl(`${baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}
        },
        body: JSON.stringify(encodedRequest),
        signal: context.signal
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage2(response));
      }
      const body = await response.json();
      const audio = decodeAudio(body);
      return {
        requestId: context.requestId,
        cacheKey: body.cacheKey,
        provider: providerId,
        voice: body.voice,
        rate: body.rate,
        format: body.format,
        cached: body.cached,
        ...audio ? { audio } : {},
        ...audio?.url ? { audioUrl: audio.url } : {},
        ...audio?.data ? { audioData: audio.data } : {},
        ...audio?.mimeType ? { mimeType: audio.mimeType } : {},
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        completedAt: (/* @__PURE__ */ new Date()).toISOString(),
        durationMs: body.durationMs,
        metadata: body.metadata
      };
    },
    async *stream(request, context) {
      const encodedRequest = encodeWorkerRequest(request, {
        format: context.plan.format,
        preferences: request.preferences,
        plan: context.plan
      });
      const response = await fetchImpl(`${baseUrl}/v1/audio/speech/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...options.apiKey ? { Authorization: `Bearer ${options.apiKey}` } : {}
        },
        body: JSON.stringify(encodedRequest),
        signal: context.signal
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage2(response));
      }
      for await (const event of readNdjson(response)) {
        yield toStreamEvent(event);
      }
    }
  };
}

// src/segments.ts
var sentenceBoundaryPattern = /(?<=[.!?])\s+/u;
function splitTextIntoParagraphs(text, targetLength = 260) {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const sentences = trimmed.split(sentenceBoundaryPattern).filter(Boolean);
  const paragraphs = [];
  let paragraphText = "";
  let paragraphStart = 0;
  for (const sentence of sentences) {
    const nextText = paragraphText ? `${paragraphText} ${sentence}` : sentence;
    if (paragraphText && nextText.length > targetLength) {
      paragraphs.push({
        index: paragraphs.length,
        text: paragraphText,
        start: paragraphStart,
        end: paragraphStart + paragraphText.length
      });
      paragraphStart += paragraphText.length + 1;
      paragraphText = sentence;
      continue;
    }
    paragraphText = nextText;
  }
  if (paragraphText) {
    paragraphs.push({
      index: paragraphs.length,
      text: paragraphText,
      start: paragraphStart,
      end: paragraphStart + paragraphText.length
    });
  }
  return paragraphs;
}
function createSegmentsFromParagraphs(paragraphs, prefix = "paragraph") {
  return paragraphs.map((paragraph) => ({
    id: `${prefix}-${paragraph.index + 1}`,
    label: `Paragraph ${paragraph.index + 1}`,
    start: paragraph.start,
    end: paragraph.end
  }));
}

// src/session.ts
function updateUnitStatus(unit, status, updates) {
  return {
    ...unit,
    ...updates,
    status
  };
}
var OraDocumentSession = class {
  text;
  paragraphLength;
  units;
  constructor(options) {
    this.text = options.text;
    this.paragraphLength = options.paragraphLength ?? 260;
    const paragraphs = splitTextIntoParagraphs(options.text, this.paragraphLength);
    const segments = createSegmentsFromParagraphs(paragraphs, "unit");
    this.units = paragraphs.map((paragraph, index) => ({
      id: segments[index]?.id ?? `unit-${index + 1}`,
      index,
      text: paragraph.text,
      start: paragraph.start,
      end: paragraph.end,
      voice: options.voice,
      rate: options.rate,
      instructions: options.instructions,
      preferences: options.preferences,
      metadata: options.metadata,
      status: "idle",
      attemptCount: 0
    }));
  }
  listUnits() {
    return this.units.map((unit) => ({ ...unit }));
  }
  getUnit(index) {
    const unit = this.units[index];
    return unit ? { ...unit } : null;
  }
  queue(index) {
    return this.replaceUnit(
      index,
      (unit) => unit.status === "idle" ? updateUnitStatus(unit, "queued") : unit
    );
  }
  startSynthesis(index) {
    return this.replaceUnit(
      index,
      (unit) => updateUnitStatus(unit, "synthesizing", {
        attemptCount: unit.attemptCount + 1,
        error: void 0
      })
    );
  }
  markReady(index, audioUrl) {
    return this.replaceUnit(
      index,
      (unit) => updateUnitStatus(unit, "ready", {
        audioUrl: audioUrl ?? unit.audioUrl
      })
    );
  }
  startPlayback(index) {
    this.units = this.units.map(
      (unit, unitIndex) => unitIndex === index ? updateUnitStatus(unit, "playing") : unit.status === "playing" ? updateUnitStatus(unit, "ready") : unit
    );
    return this.snapshot();
  }
  markDone(index) {
    return this.replaceUnit(index, (unit) => updateUnitStatus(unit, "done"));
  }
  markFailed(index, error) {
    return this.replaceUnit(
      index,
      (unit) => updateUnitStatus(unit, "failed", {
        error
      })
    );
  }
  reset() {
    this.units = this.units.map((unit) => ({
      ...unit,
      status: "idle",
      attemptCount: 0,
      audioUrl: void 0,
      error: void 0
    }));
    return this.snapshot();
  }
  snapshot() {
    const units = this.listUnits();
    return {
      text: this.text,
      units,
      queuedCount: units.filter((unit) => unit.status === "queued").length,
      synthesizingCount: units.filter((unit) => unit.status === "synthesizing").length,
      readyCount: units.filter((unit) => unit.status === "ready").length,
      playingCount: units.filter((unit) => unit.status === "playing").length,
      doneCount: units.filter((unit) => unit.status === "done").length,
      failedCount: units.filter((unit) => unit.status === "failed").length
    };
  }
  replaceUnit(index, updater) {
    const current = this.units[index];
    if (!current) {
      throw new Error(`Ora document session unit ${index} is out of bounds.`);
    }
    this.units[index] = updater(current);
    return this.snapshot();
  }
};
function createOraDocumentSession(options) {
  return new OraDocumentSession(options);
}

// src/tokenize.ts
var tokenPattern = /\p{L}[\p{L}\p{N}'’-]*|\p{N}+|[^\s]/gu;
function tokenizeText(text) {
  const tokens = [];
  for (const match of text.matchAll(tokenPattern)) {
    const raw = match[0] ?? "";
    const start = match.index ?? 0;
    const end = start + raw.length;
    tokens.push({
      index: tokens.length,
      text: raw,
      start,
      end,
      isWord: /[\p{L}\p{N}]/u.test(raw)
    });
  }
  return tokens;
}
function findTokenAtCharIndex(tokens, charIndex) {
  if (tokens.length === 0) {
    return null;
  }
  const clampedCharIndex = Math.max(0, charIndex);
  return tokens.find((token) => clampedCharIndex >= token.start && clampedCharIndex < token.end) ?? tokens.findLast((token) => token.start <= clampedCharIndex) ?? tokens[0];
}

// src/timeline.ts
function getTokenWeightMs(token, minimumTokenMs, punctuationPauseMs) {
  const lengthWeight = token.isWord ? token.text.length * 38 : 0;
  const punctuationWeight = /^[,.;:!?)]$/.test(token.text) ? punctuationPauseMs : 0;
  const quoteWeight = /^["“”'‘’]$/.test(token.text) ? punctuationPauseMs * 0.35 : 0;
  return Math.max(minimumTokenMs, lengthWeight + punctuationWeight + quoteWeight);
}
function createEstimatedTimeline(options) {
  const tokens = options.tokens ?? tokenizeText(options.text);
  const minimumTokenMs = options.minimumTokenMs ?? 80;
  const punctuationPauseMs = options.punctuationPauseMs ?? 90;
  const charactersPerSecond = options.charactersPerSecond ?? 14;
  if (tokens.length === 0) {
    return [];
  }
  const fallbackDurationMs = Math.max(1, options.text.length / charactersPerSecond * 1e3);
  const targetDurationMs = options.durationMs ?? fallbackDurationMs;
  const rawWeights = tokens.map((token) => getTokenWeightMs(token, minimumTokenMs, punctuationPauseMs));
  const totalWeight = rawWeights.reduce((sum, value) => sum + value, 0) || targetDurationMs;
  const scale = targetDurationMs / totalWeight;
  let cursorMs = 0;
  return tokens.map((token, index) => {
    const weightMs = rawWeights[index] * scale;
    const startMs = cursorMs;
    const endMs = startMs + weightMs;
    cursorMs = endMs;
    return {
      ...token,
      startMs,
      endMs,
      weightMs
    };
  });
}
function findTimedTokenAtTime(timeline, timeMs) {
  if (timeline.length === 0) {
    return null;
  }
  const clampedTimeMs = Math.max(0, timeMs);
  return timeline.find((token) => clampedTimeMs >= token.startMs && clampedTimeMs < token.endMs) ?? timeline.findLast((token) => token.startMs <= clampedTimeMs) ?? timeline[0];
}

// src/tracker.ts
function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
function findSegmentAtCharIndex(segments, charIndex) {
  if (segments.length === 0) {
    return { segment: null, segmentIndex: -1 };
  }
  const segmentIndex = segments.findIndex(
    (segment) => charIndex >= segment.start && charIndex < segment.end
  );
  if (segmentIndex >= 0) {
    return {
      segment: segments[segmentIndex] ?? null,
      segmentIndex
    };
  }
  const fallbackIndex = segments.findLastIndex((segment) => segment.start <= charIndex);
  if (fallbackIndex >= 0) {
    return {
      segment: segments[fallbackIndex] ?? null,
      segmentIndex: fallbackIndex
    };
  }
  return {
    segment: segments[0] ?? null,
    segmentIndex: segments[0] ? 0 : -1
  };
}
var OraPlaybackTracker = class {
  text;
  tokens;
  segments;
  timeline;
  currentTimeMs = 0;
  currentCharIndex = 0;
  source = "idle";
  constructor(options) {
    this.text = options.text;
    this.tokens = options.tokens ?? tokenizeText(options.text);
    this.segments = [...options.segments ?? []].sort((left, right) => left.start - right.start);
    this.timeline = options.timeline ?? createEstimatedTimeline({ text: options.text, tokens: this.tokens });
  }
  reset() {
    this.currentTimeMs = 0;
    this.currentCharIndex = 0;
    this.source = "idle";
    return this.snapshot();
  }
  updateFromBoundary(charIndex, timeMs = this.currentTimeMs) {
    this.source = "boundary";
    this.currentCharIndex = clamp(charIndex, 0, this.text.length);
    this.currentTimeMs = Math.max(0, timeMs);
    return this.snapshot();
  }
  updateFromProviderMark(charIndex, timeMs = this.currentTimeMs) {
    this.source = "provider-mark";
    this.currentCharIndex = clamp(charIndex, 0, this.text.length);
    this.currentTimeMs = Math.max(0, timeMs);
    return this.snapshot();
  }
  updateFromClock(timeMs) {
    this.source = "estimated-clock";
    this.currentTimeMs = Math.max(0, timeMs);
    const activeToken = findTimedTokenAtTime(this.timeline, this.currentTimeMs);
    this.currentCharIndex = activeToken?.start ?? 0;
    return this.snapshot();
  }
  updateFromProgress(progress) {
    const totalDurationMs = this.timeline[this.timeline.length - 1]?.endMs ?? 0;
    return this.updateFromClock(totalDurationMs * clamp(progress, 0, 1));
  }
  snapshot() {
    const token = this.source === "estimated-clock" ? findTimedTokenAtTime(this.timeline, this.currentTimeMs) : findTokenAtCharIndex(this.tokens, this.currentCharIndex);
    const tokenIndex = token?.index ?? -1;
    const { segment, segmentIndex } = findSegmentAtCharIndex(this.segments, this.currentCharIndex);
    const totalDurationMs = this.timeline[this.timeline.length - 1]?.endMs ?? 0;
    const progress = this.source === "estimated-clock" && totalDurationMs > 0 ? clamp(this.currentTimeMs / totalDurationMs, 0, 1) : this.text.length > 0 ? clamp(this.currentCharIndex / this.text.length, 0, 1) : 0;
    return {
      source: this.source,
      currentTimeMs: this.currentTimeMs,
      currentCharIndex: this.currentCharIndex,
      progress,
      token: token ?? null,
      tokenIndex,
      segment,
      segmentIndex
    };
  }
};

// src/orchestrator.ts
function findActiveUnit(units) {
  return units.find((unit) => unit.status === "playing") ?? units.find((unit) => unit.status === "ready") ?? units.find((unit) => unit.status === "synthesizing") ?? units.find((unit) => unit.status === "queued") ?? null;
}
function findNextUnit(units, activeUnit) {
  if (!activeUnit) {
    return units.find((unit) => unit.status !== "done") ?? null;
  }
  return units.find((unit) => unit.index > activeUnit.index && unit.status !== "done") ?? null;
}
var OraPlaybackOrchestrator = class {
  text;
  tracker;
  units;
  firstAudioMs = null;
  constructor(options) {
    this.text = options.session.text;
    this.units = options.session.units.map((unit) => ({ ...unit }));
    const tokens = tokenizeText(this.text);
    const timeline = createEstimatedTimeline({
      text: this.text,
      tokens
    });
    this.tracker = new OraPlaybackTracker({
      text: this.text,
      tokens,
      timeline,
      segments: this.units.map((unit) => ({
        id: unit.id,
        label: `Paragraph ${unit.index + 1}`,
        start: unit.start,
        end: unit.end
      }))
    });
  }
  queue(index) {
    this.updateUnit(index, (unit) => unit.status === "idle" ? { ...unit, status: "queued" } : unit);
    return this.snapshot();
  }
  startSynthesis(index, startedAtMs) {
    this.updateUnit(index, (unit) => ({
      ...unit,
      status: "synthesizing",
      attemptCount: unit.attemptCount + 1,
      error: void 0
    }));
    if (this.firstAudioMs === null && typeof startedAtMs === "number") {
      this.firstAudioMs = Math.max(0, startedAtMs);
    }
    return this.snapshot();
  }
  markReady(index, audioUrl) {
    this.updateUnit(index, (unit) => ({
      ...unit,
      status: "ready",
      audioUrl: audioUrl ?? unit.audioUrl
    }));
    return this.snapshot();
  }
  async synthesizeUnit(runtime, options) {
    const unit = this.units[options.index];
    if (!unit) {
      throw new Error(`Ora playback orchestrator unit ${options.index} is out of bounds.`);
    }
    this.queue(options.index);
    this.startSynthesis(options.index, options.startLatencyMs);
    try {
      const response = await runtime.synthesize({
        provider: options.provider,
        text: unit.text,
        voice: unit.voice,
        rate: unit.rate,
        instructions: unit.instructions,
        preferences: unit.preferences,
        metadata: unit.metadata
      });
      this.updateUnit(options.index, (current) => ({
        ...current,
        status: "ready",
        audioUrl: response.audioUrl,
        audioData: response.audioData,
        mimeType: response.mimeType,
        durationMs: response.durationMs,
        error: void 0
      }));
      return this.snapshot();
    } catch (error) {
      this.markFailed(
        options.index,
        error instanceof Error ? error.message : "Unknown synthesis failure."
      );
      throw error;
    }
  }
  async synthesizeNextPending(runtime, provider) {
    const next = this.units.find((unit) => unit.status === "idle" || unit.status === "queued");
    if (!next) {
      return this.snapshot();
    }
    return this.synthesizeUnit(runtime, {
      provider,
      index: next.index
    });
  }
  startPlayback(index, timeMs = 0) {
    this.units.forEach((unit, unitIndex) => {
      if (unitIndex === index) {
        unit.status = "playing";
      } else if (unit.status === "playing") {
        unit.status = "ready";
      }
    });
    const active = this.units[index];
    if (active) {
      this.tracker.updateFromBoundary(active.start, timeMs);
    }
    return this.snapshot();
  }
  advance(timeMs) {
    this.tracker.updateFromClock(timeMs);
    return this.snapshot();
  }
  markDone(index, timeMs) {
    this.updateUnit(index, (unit2) => ({
      ...unit2,
      status: "done"
    }));
    const unit = this.units[index];
    if (unit && typeof timeMs === "number") {
      this.tracker.updateFromBoundary(unit.end, timeMs);
    }
    return this.snapshot();
  }
  markFailed(index, error) {
    this.updateUnit(index, (unit) => ({
      ...unit,
      status: "failed",
      error
    }));
    return this.snapshot();
  }
  snapshot() {
    const session = {
      text: this.text,
      units: this.units.map((unit) => ({ ...unit })),
      queuedCount: this.units.filter((unit) => unit.status === "queued").length,
      synthesizingCount: this.units.filter((unit) => unit.status === "synthesizing").length,
      readyCount: this.units.filter((unit) => unit.status === "ready").length,
      playingCount: this.units.filter((unit) => unit.status === "playing").length,
      doneCount: this.units.filter((unit) => unit.status === "done").length,
      failedCount: this.units.filter((unit) => unit.status === "failed").length
    };
    const activeUnit = findActiveUnit(session.units);
    const nextUnit = findNextUnit(session.units, activeUnit);
    const tracker = this.tracker.snapshot();
    return {
      session,
      activeUnit,
      nextUnit,
      bufferedUnitCount: session.units.filter(
        (unit) => unit.status === "ready" || unit.status === "playing" || unit.status === "done"
      ).length,
      pendingUnitCount: session.units.filter((unit) => unit.status !== "done").length,
      firstAudioMs: this.firstAudioMs,
      tracker
    };
  }
  updateUnit(index, updater) {
    const current = this.units[index];
    if (!current) {
      throw new Error(`Ora playback orchestrator unit ${index} is out of bounds.`);
    }
    this.units[index] = updater({ ...current });
  }
};
function createOraPlaybackOrchestrator(options) {
  return new OraPlaybackOrchestrator(options);
}

// src/synthesis-plan.ts
function resolveDelivery(requestedDelivery, priority) {
  if (requestedDelivery && requestedDelivery !== "auto") {
    return requestedDelivery;
  }
  return priority === "responsiveness" ? "streaming" : "buffered";
}
function resolveSynthesisPlan(request) {
  const priority = request.preferences?.priority ?? "balanced";
  const delivery = resolveDelivery(request.preferences?.delivery, priority);
  const format = request.format ?? (delivery === "streaming" ? "opus" : "mp3");
  if (priority === "quality") {
    return {
      priority,
      delivery,
      format,
      bitrateKbps: request.preferences?.bitrateKbps ?? 192,
      sampleRateHz: request.preferences?.sampleRateHz ?? 48e3,
      cacheStrategy: "full-audio"
    };
  }
  if (priority === "responsiveness") {
    return {
      priority,
      delivery,
      format,
      bitrateKbps: request.preferences?.bitrateKbps ?? 64,
      sampleRateHz: request.preferences?.sampleRateHz ?? 24e3,
      cacheStrategy: delivery === "streaming" ? "progressive" : "full-audio"
    };
  }
  return {
    priority,
    delivery,
    format,
    bitrateKbps: request.preferences?.bitrateKbps ?? 128,
    sampleRateHz: request.preferences?.sampleRateHz ?? 44100,
    cacheStrategy: delivery === "streaming" ? "progressive" : "full-audio"
  };
}

// src/runtime.ts
function normalizeAudioAsset(source) {
  const data = source.audio?.data ?? source.audioData;
  const url = source.audio?.url ?? source.audioUrl;
  const mimeType = source.audio?.mimeType ?? source.mimeType;
  const audio = data || url || mimeType ? {
    ...data ? { data } : {},
    ...url ? { url } : {},
    ...mimeType ? { mimeType } : {}
  } : void 0;
  return {
    audio,
    ...data ? { audioData: data } : {},
    ...url ? { audioUrl: url } : {},
    ...mimeType ? { mimeType } : {}
  };
}
function createDefaultRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ora-${Math.random().toString(36).slice(2, 10)}`;
}
var OraRuntime = class {
  providers = /* @__PURE__ */ new Map();
  credentialStore;
  cacheStore;
  instrumentation;
  now;
  createRequestId;
  constructor(options = {}) {
    this.credentialStore = options.credentialStore ?? new OraMemoryCredentialStore();
    this.cacheStore = options.cacheStore ?? null;
    this.instrumentation = [...options.instrumentation ?? []];
    this.now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.createRequestId = options.createRequestId ?? createDefaultRequestId;
    for (const provider of options.providers ?? []) {
      void this.registerProvider(provider);
    }
  }
  async registerProvider(provider) {
    this.providers.set(provider.id, provider);
    await this.emit({
      name: "provider:registered",
      provider: provider.id,
      attributes: {}
    });
  }
  getProvider(provider) {
    return this.providers.get(provider) ?? null;
  }
  provider(providerId) {
    const provider = this.requireProvider(providerId);
    const label = provider.label ?? String(provider.id);
    return {
      id: provider.id,
      label,
      raw: () => provider,
      summary: () => ({
        id: provider.id,
        label,
        hasCredentials: this.hasCredentials(provider.id),
        capabilities: this.getProviderCapabilities(provider)
      }),
      hasCredentials: () => this.hasCredentials(provider.id),
      getCredentials: () => this.getCredentials(provider.id),
      setCredentials: (credentials) => this.setCredentials(provider.id, credentials),
      deleteCredentials: () => this.deleteCredentials(provider.id),
      listVoices: () => this.listVoices(provider.id),
      synthesize: (request, options) => this.synthesize({ ...request, provider: provider.id }, options),
      stream: (request, options) => this.stream({ ...request, provider: provider.id }, options)
    };
  }
  providerClients() {
    return [...this.providers.keys()].map((providerId) => this.provider(providerId));
  }
  listProviders() {
    return [...this.providers.keys()];
  }
  async listProviderSummaries() {
    return this.providerClients().map((provider) => provider.summary());
  }
  async catalog() {
    const providers = await Promise.all(
      this.providerClients().map(async (provider) => ({
        ...provider.summary(),
        voices: await provider.listVoices()
      }))
    );
    return { providers };
  }
  async listVoices(providerId) {
    const provider = this.requireProvider(providerId);
    if (!provider.listVoices) {
      return [];
    }
    const voices = await provider.listVoices();
    return voices.map((voice) => ({
      ...voice,
      provider: voice.provider ?? provider.id,
      label: voice.label || voice.id
    }));
  }
  setCredentials(provider, credentials) {
    this.credentialStore.set(provider, credentials);
  }
  async getCacheEntry(key) {
    if (!this.cacheStore) {
      return null;
    }
    return (await this.cacheStore.peek(key))?.entry ?? null;
  }
  async queryCache(query = {}) {
    if (!this.cacheStore) {
      return [];
    }
    return this.cacheStore.list(query);
  }
  async deleteCacheEntry(key) {
    if (!this.cacheStore) {
      return false;
    }
    return this.cacheStore.delete(key);
  }
  getCredentials(provider) {
    return this.credentialStore.get(provider);
  }
  deleteCredentials(provider) {
    return this.credentialStore.delete(provider);
  }
  hasCredentials(provider) {
    return this.credentialStore.has(provider);
  }
  credentialProviders() {
    return this.credentialStore.providers();
  }
  async synthesize(request, options = {}) {
    const provider = this.requireProvider(request.provider);
    const requestId = this.createRequestId();
    const credentials = this.credentialStore.get(request.provider) ?? {};
    const startedAt = this.now();
    const context = await this.createContext(request, requestId, credentials, options);
    const cacheKey = await this.resolveCacheKey(provider, request, context);
    await this.emitQueued(request, requestId, credentials, context.plan);
    const cachedRecord = cacheKey ? await this.cacheStore?.get(cacheKey) : void 0;
    if (cachedRecord) {
      const completedAt = this.now();
      const normalizedResponse = this.normalizeResponse(
        request,
        {
          ...cachedRecord.response,
          cacheKey,
          cached: true
        },
        requestId,
        startedAt,
        completedAt,
        0
      );
      await this.emit({
        name: "synthesis:succeeded",
        provider: request.provider,
        requestId,
        attributes: {
          cached: true,
          durationMs: normalizedResponse.durationMs,
          format: normalizedResponse.format
        }
      });
      return normalizedResponse;
    }
    await this.emitStarted(request, requestId, context.plan);
    try {
      const response = await provider.synthesize(request, context);
      const completedAt = this.now();
      const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
      const normalizedResponse = this.normalizeResponse(
        request,
        response,
        requestId,
        startedAt,
        completedAt,
        durationMs
      );
      if (this.cacheStore && cacheKey) {
        await this.cacheStore.set(await this.createCacheRecord(cacheKey, request, normalizedResponse));
      }
      await this.emit({
        name: "synthesis:succeeded",
        provider: request.provider,
        requestId,
        attributes: {
          cached: normalizedResponse.cached,
          durationMs: normalizedResponse.durationMs,
          format: normalizedResponse.format
        }
      });
      return normalizedResponse;
    } catch (error) {
      await this.emit({
        name: "synthesis:failed",
        provider: request.provider,
        requestId,
        attributes: {
          format: request.format ?? "mp3"
        },
        error: {
          name: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : "Unknown Ora synthesis error."
        }
      });
      throw error;
    }
  }
  async *stream(request, options = {}) {
    const provider = this.requireProvider(request.provider);
    if (!provider.stream) {
      throw new Error(`Ora provider "${request.provider}" does not implement streaming.`);
    }
    const requestId = this.createRequestId();
    const credentials = this.credentialStore.get(request.provider) ?? {};
    const startedAt = this.now();
    const context = await this.createContext(request, requestId, credentials, options);
    let completed = false;
    await this.emitQueued(request, requestId, credentials, context.plan);
    await this.emitStarted(request, requestId, context.plan);
    yield {
      type: "started",
      requestId,
      provider: request.provider,
      timestamp: startedAt.toISOString(),
      metadata: {
        voice: request.voice ?? null,
        format: request.format ?? "mp3"
      }
    };
    try {
      const stream = await provider.stream(request, context);
      for await (const event of stream) {
        const normalizedEvent = this.normalizeStreamEvent(request, requestId, event);
        completed ||= normalizedEvent.type === "completed";
        yield normalizedEvent;
      }
      const completedAt = this.now();
      const durationMs = Math.max(0, completedAt.getTime() - startedAt.getTime());
      if (!completed) {
        yield {
          type: "completed",
          requestId,
          provider: request.provider,
          timestamp: completedAt.toISOString(),
          timeMs: durationMs
        };
      }
      await this.emit({
        name: "synthesis:succeeded",
        provider: request.provider,
        requestId,
        attributes: {
          durationMs,
          format: request.format ?? "mp3",
          mode: "stream"
        }
      });
    } catch (error) {
      await this.emit({
        name: "synthesis:failed",
        provider: request.provider,
        requestId,
        attributes: {
          format: request.format ?? "mp3",
          mode: "stream"
        },
        error: {
          name: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : "Unknown Ora synthesis stream error."
        }
      });
      throw error;
    }
  }
  getProviderCapabilities(provider) {
    return {
      buffered: true,
      streaming: Boolean(provider.stream),
      voiceDiscovery: Boolean(provider.listVoices)
    };
  }
  requireProvider(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`No Ora provider registered for "${providerId}".`);
    }
    return provider;
  }
  normalizeResponse(request, response, requestId, startedAt, completedAt, durationMs) {
    const normalized = {
      ...response,
      requestId,
      provider: response.provider ?? request.provider,
      voice: response.voice ?? request.voice ?? "default",
      rate: response.rate ?? request.rate ?? 1,
      format: response.format ?? request.format ?? "mp3",
      startedAt: response.startedAt ?? startedAt.toISOString(),
      completedAt: response.completedAt ?? completedAt.toISOString(),
      durationMs: response.durationMs ?? durationMs
    };
    return {
      ...normalized,
      ...normalizeAudioAsset(normalized)
    };
  }
  async resolveCacheKey(provider, request, context) {
    if (provider.getCacheKey) {
      return provider.getCacheKey(request, context);
    }
    const digest = await createDigest(
      JSON.stringify({
        provider: request.provider,
        text: request.text,
        voice: request.voice ?? "default",
        rate: request.rate ?? 1,
        instructions: request.instructions ?? "",
        format: request.format ?? context.plan.format,
        plan: context.plan
      })
    );
    return `${request.provider}:${digest}`;
  }
  async createCacheRecord(key, request, response) {
    const timestamp = this.now().toISOString();
    const audio = response.audio;
    return {
      entry: {
        key,
        provider: response.provider,
        voice: response.voice,
        format: response.format,
        textHash: await createDigest(request.text),
        textLength: request.text.length,
        durationMs: response.durationMs,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastAccessedAt: timestamp,
        hitCount: 0,
        cached: true,
        hasAudioData: Boolean(audio?.data ?? response.audioData),
        audioUrl: audio?.url ?? response.audioUrl,
        mimeType: audio?.mimeType ?? response.mimeType,
        metadata: response.metadata
      },
      response: {
        ...response,
        cached: false
      }
    };
  }
  normalizeStreamEvent(request, requestId, event) {
    return {
      ...event,
      requestId,
      provider: request.provider,
      timestamp: event.timestamp ?? this.now().toISOString()
    };
  }
  async createContext(request, requestId, credentials, options) {
    const plan = resolveSynthesisPlan(request);
    return {
      requestId,
      provider: request.provider,
      credentials,
      plan,
      signal: options.signal,
      emit: (event) => this.emit({
        ...event,
        provider: request.provider,
        requestId
      })
    };
  }
  async emitQueued(request, requestId, credentials, plan) {
    await this.emit({
      name: "synthesis:queued",
      provider: request.provider,
      requestId,
      attributes: {
        format: plan.format,
        hasVoice: Boolean(request.voice),
        textLength: request.text.length,
        priority: plan.priority,
        delivery: plan.delivery
      }
    });
    await this.emit({
      name: "credentials:resolved",
      provider: request.provider,
      requestId,
      attributes: {
        credentialCount: Object.keys(credentials).length
      }
    });
  }
  async emitStarted(request, requestId, plan) {
    await this.emit({
      name: "synthesis:started",
      provider: request.provider,
      requestId,
      attributes: {
        voice: request.voice ?? null,
        bitrateKbps: plan.bitrateKbps,
        sampleRateHz: plan.sampleRateHz
      }
    });
  }
  async emit(event) {
    const normalizedEvent = {
      ...event,
      timestamp: event.timestamp ?? this.now().toISOString()
    };
    await Promise.all(this.instrumentation.map((sink) => sink.emit(normalizedEvent)));
  }
};
function createOraRuntime(options = {}) {
  return new OraRuntime(options);
}

// src/worker.ts
var import_node_crypto = require("crypto");
var import_node_child_process = require("child_process");
var import_node_http = require("http");
var import_promises = require("fs/promises");
var import_node_path = require("path");
var import_node_os = require("os");
function toBase64(bytes) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
function resolveMimeType3(format) {
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
function getFetch3(fetchImpl) {
  if (fetchImpl) {
    return fetchImpl;
  }
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available in this runtime.");
  }
  return fetch;
}
function createCacheKey2(request) {
  return (0, import_node_crypto.createHash)("sha256").update(
    JSON.stringify({
      text: request.text,
      voice: request.voice ?? "default",
      rate: request.rate ?? 1,
      format: request.format ?? request.plan?.format ?? "mp3",
      instructions: request.instructions ?? ""
    })
  ).digest("hex");
}
function createTextHash(text) {
  return (0, import_node_crypto.createHash)("sha256").update(text).digest("hex");
}
async function execFile(command, args) {
  return new Promise((resolveExec, reject) => {
    const child = (0, import_node_child_process.spawn)(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
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
function parseWaveDurationMs(bytes) {
  if (bytes.length < 44) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const wave = String.fromCharCode(...bytes.slice(8, 12));
  if (riff !== "RIFF" || wave !== "WAVE") {
    return null;
  }
  let offset = 12;
  let sampleRate = 0;
  let blockAlign = 0;
  while (offset + 8 <= bytes.length) {
    const chunkId = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkId === "fmt " && chunkStart + 16 <= bytes.length) {
      sampleRate = view.getUint32(chunkStart + 4, true);
      blockAlign = view.getUint16(chunkStart + 12, true);
    }
    if (chunkId === "data" && sampleRate > 0 && blockAlign > 0) {
      return Math.round(chunkSize / blockAlign / sampleRate * 1e3);
    }
    offset = chunkStart + chunkSize + chunkSize % 2;
  }
  return null;
}
async function getAudioDurationMs(path) {
  try {
    const { stdout } = await execFile("/usr/bin/afinfo", [path]);
    const match = stdout.match(/estimated duration:\s+([0-9.]+)\s+sec/i);
    if (!match) {
      return 0;
    }
    return Math.round(Number(match[1]) * 1e3);
  } catch {
    const bytes = await (0, import_promises.readFile)(path);
    return parseWaveDurationMs(bytes) ?? 0;
  }
}
async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
  }
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return JSON.parse(bytes.toString("utf8"));
}
function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}
function isAuthorized(request, token) {
  if (!token) {
    return true;
  }
  return request.headers.authorization === `Bearer ${token}`;
}
async function writeNdjson(response, stream) {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/x-ndjson");
  response.setHeader("Cache-Control", "no-store");
  for await (const event of stream) {
    response.write(`${JSON.stringify(event)}
`);
  }
  response.end();
}
function normalizeResult(request, result, requestId) {
  const format = result.format ?? request.format ?? request.plan?.format ?? "mp3";
  const audioData = result.audio?.data ?? result.audioData;
  const audioUrl = result.audio?.url ?? result.audioUrl;
  const mimeType = result.audio?.mimeType ?? result.mimeType ?? resolveMimeType3(format);
  const audio = audioData || audioUrl || mimeType ? {
    ...audioData ? { base64: toBase64(audioData) } : {},
    ...audioUrl ? { url: audioUrl } : {},
    ...mimeType ? { mimeType } : {}
  } : void 0;
  return {
    requestId,
    cacheKey: createCacheKey2(request),
    voice: result.voice ?? request.voice ?? "default",
    rate: result.rate ?? request.rate ?? 1,
    format,
    cached: result.cached ?? false,
    ...audio ? { audio } : {},
    ...audio?.base64 ? { audioBase64: audio.base64 } : {},
    ...audio?.url ? { audioUrl: audio.url } : {},
    ...audio?.mimeType ? { mimeType: audio.mimeType } : {},
    durationMs: result.durationMs ?? 0,
    metadata: result.metadata
  };
}
function createRuntimeCacheRecord(backendId, request, result, response) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const audioData = result.audio?.data ?? result.audioData;
  const audioUrl = result.audio?.url ?? result.audioUrl;
  const mimeType = result.audio?.mimeType ?? result.mimeType ?? response.mimeType;
  const normalizedResponse = {
    requestId: response.requestId,
    cacheKey: response.cacheKey,
    provider: backendId,
    voice: response.voice,
    rate: response.rate,
    format: response.format,
    cached: false,
    ...audioData || audioUrl || mimeType ? {
      audio: {
        ...audioData ? { data: audioData } : {},
        ...audioUrl ? { url: audioUrl } : {},
        ...mimeType ? { mimeType } : {}
      }
    } : {},
    ...audioData ? { audioData } : {},
    ...audioUrl ? { audioUrl } : {},
    ...mimeType ? { mimeType } : {},
    startedAt: timestamp,
    completedAt: timestamp,
    durationMs: response.durationMs,
    metadata: response.metadata
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
      ...audioUrl ? { audioUrl } : {},
      ...mimeType ? { mimeType } : {},
      ...response.metadata ? { metadata: response.metadata } : {}
    },
    response: normalizedResponse
  };
}
function toWorkerResponseFromCache(record, requestId) {
  const audioData = record.response.audio?.data ?? record.response.audioData;
  const audioUrl = record.response.audio?.url ?? record.response.audioUrl;
  const mimeType = record.response.audio?.mimeType ?? record.response.mimeType;
  const audio = audioData || audioUrl || mimeType ? {
    ...audioData ? { base64: toBase64(audioData) } : {},
    ...audioUrl ? { url: audioUrl } : {},
    ...mimeType ? { mimeType } : {}
  } : void 0;
  return {
    requestId,
    cacheKey: record.entry.key,
    voice: record.entry.voice,
    rate: record.response.rate,
    format: record.entry.format,
    cached: true,
    ...audio ? { audio } : {},
    ...audio?.base64 ? { audioBase64: audio.base64 } : {},
    ...audio?.url ? { audioUrl: audio.url } : {},
    ...audio?.mimeType ? { mimeType: audio.mimeType } : {},
    durationMs: record.entry.durationMs,
    metadata: record.response.metadata
  };
}
function parseCacheQuery(url) {
  const limit = url.searchParams.get("limit");
  return {
    ...url.searchParams.get("provider") ? { provider: url.searchParams.get("provider") ?? "" } : {},
    ...url.searchParams.get("voice") ? { voice: url.searchParams.get("voice") ?? "" } : {},
    ...url.searchParams.get("format") ? { format: url.searchParams.get("format") } : {},
    ...url.searchParams.get("textHash") ? { textHash: url.searchParams.get("textHash") ?? "" } : {},
    ...limit ? { limit: Number(limit) } : {}
  };
}
function getBackendLabel(backend) {
  return backend.label ?? String(backend.id);
}
function getBackendCapabilities(backend) {
  return {
    buffered: true,
    streaming: Boolean(backend.stream),
    voiceDiscovery: true
  };
}
function getBackendSummary(backend) {
  return {
    id: backend.id,
    label: getBackendLabel(backend),
    // Worker callers should treat the exposed backend as ready to serve requests.
    hasCredentials: true,
    capabilities: getBackendCapabilities(backend)
  };
}
async function getBackendCatalog(backend) {
  const voices = await backend.listVoices();
  const provider = {
    ...getBackendSummary(backend),
    voices
  };
  return {
    providers: [provider]
  };
}
function createMockOraWorkerBackend(options = {}) {
  const providerId = options.provider ?? "mock";
  const voiceId = options.voice ?? "mock-voice";
  const voices = [
    { id: voiceId, label: "Mock Voice", provider: providerId, tags: ["mock"] }
  ];
  return {
    id: providerId,
    label: "Mock",
    listVoices() {
      return voices;
    },
    health() {
      return { ok: true };
    },
    async synthesize(request) {
      const format = request.format ?? request.plan?.format ?? "mp3";
      const payload = new TextEncoder().encode(
        `ORA_MOCK_AUDIO:${request.voice ?? voiceId}:${format}:${request.text}`
      );
      return {
        audio: {
          data: payload,
          mimeType: resolveMimeType3(format)
        },
        audioData: payload,
        voice: request.voice ?? voiceId,
        format,
        mimeType: resolveMimeType3(format),
        durationMs: Math.max(320, request.text.length * 45),
        cached: false,
        metadata: {
          backend: "mock"
        }
      };
    },
    async *stream(request) {
      const requestId = (0, import_node_crypto.randomUUID)();
      const format = request.format ?? request.plan?.format ?? "mp3";
      const payload = new TextEncoder().encode(
        `ORA_MOCK_STREAM:${request.voice ?? voiceId}:${format}:${request.text}`
      );
      const tokens = tokenizeText(request.text);
      const timeline = createEstimatedTimeline({
        text: request.text,
        tokens,
        durationMs: Math.max(320, request.text.length * 45)
      });
      const startedMetadata = {
        backend: "mock",
        voice: request.voice ?? voiceId,
        format
      };
      const streamMetadata = {
        voice: request.voice ?? voiceId,
        format
      };
      yield {
        type: "started",
        requestId,
        metadata: startedMetadata
      };
      yield {
        type: "metadata",
        metadata: streamMetadata
      };
      yield {
        type: "audio",
        audioBase64: toBase64(payload),
        mimeType: resolveMimeType3(format)
      };
      for (const token of timeline) {
        if (!token.isWord) {
          continue;
        }
        yield {
          type: "boundary",
          charIndex: token.start,
          timeMs: token.startMs
        };
      }
      yield {
        type: "completed",
        timeMs: timeline.at(-1)?.endMs ?? 0
      };
    }
  };
}
function createHttpOraWorkerBackend(options) {
  const fetchImpl = getFetch3(options.fetch);
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const model = options.model ?? "mlx-community/Kokoro-82M-bf16";
  const defaultVoice = options.voice ?? "af_heart";
  const langCode = options.langCode ?? "a";
  return {
    id: options.id ?? "http",
    label: "HTTP",
    async listVoices() {
      return [
        {
          id: defaultVoice,
          label: `${defaultVoice} (${model})`,
          provider: options.id ?? "http",
          tags: ["default"],
          metadata: {
            model
          }
        }
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
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          input: request.text,
          voice: request.voice ?? defaultVoice,
          lang_code: langCode,
          speed: request.rate ?? 1,
          response_format: format
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP worker backend failed with status ${response.status}.`);
      }
      const audioData = new Uint8Array(await response.arrayBuffer());
      const filePath = (0, import_node_path.resolve)((0, import_node_os.tmpdir)(), `ora-worker-proxy-${(0, import_node_crypto.randomUUID)()}.wav`);
      await (0, import_promises.writeFile)(filePath, audioData);
      const durationMs = await getAudioDurationMs(filePath);
      return {
        audio: {
          data: audioData,
          mimeType: response.headers.get("content-type") ?? "audio/wav"
        },
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
          upstream: baseUrl
        }
      };
    },
    async *stream(request) {
      const requestId = (0, import_node_crypto.randomUUID)();
      const result = await this.synthesize(request);
      const tokens = tokenizeText(request.text);
      const timeline = createEstimatedTimeline({
        text: request.text,
        tokens,
        durationMs: result.durationMs ?? Math.max(320, request.text.length * 45)
      });
      yield {
        type: "started",
        requestId,
        metadata: {
          backend: "http",
          model,
          voice: request.voice ?? defaultVoice
        }
      };
      yield {
        type: "audio",
        audioBase64: toBase64(result.audioData ?? new Uint8Array()),
        mimeType: result.mimeType
      };
      for (const token of timeline) {
        if (!token.isWord) {
          continue;
        }
        yield {
          type: "boundary",
          charIndex: token.start,
          timeMs: token.startMs
        };
      }
      yield {
        type: "completed",
        timeMs: result.durationMs,
        metadata: result.metadata
      };
    }
  };
}
function createOraWorkerServer(options) {
  let address = null;
  const server = (0, import_node_http.createServer)(async (request, response) => {
    try {
      if (!isAuthorized(request, options.token)) {
        sendJson(response, 401, { error: "Unauthorized." });
        return;
      }
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/health") {
        const voices = await options.backend.listVoices();
        const status = await options.backend.health();
        const body = {
          ok: status.ok,
          provider: options.backend.id,
          voices,
          capabilities: {
            streaming: Boolean(options.backend.stream),
            boundaries: Boolean(options.backend.stream)
          }
        };
        sendJson(response, 200, body);
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/voices") {
        sendJson(response, 200, {
          voices: await options.backend.listVoices()
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/providers") {
        sendJson(response, 200, {
          providers: [getBackendSummary(options.backend)]
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/catalog") {
        sendJson(response, 200, await getBackendCatalog(options.backend));
        return;
      }
      if (request.method === "GET" && url.pathname.startsWith("/v1/providers/")) {
        const suffix = url.pathname.slice("/v1/providers/".length);
        const voicesSuffix = "/voices";
        const providerId = decodeURIComponent(
          suffix.endsWith(voicesSuffix) ? suffix.slice(0, -voicesSuffix.length) : suffix
        );
        if (providerId !== options.backend.id) {
          sendJson(response, 404, { error: "Provider not found." });
          return;
        }
        if (suffix.endsWith(voicesSuffix)) {
          sendJson(response, 200, {
            voices: await options.backend.listVoices()
          });
          return;
        }
        sendJson(response, 200, {
          provider: getBackendSummary(options.backend)
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/cache") {
        if (!options.cacheStore) {
          sendJson(response, 501, { error: "Cache is not configured for this worker." });
          return;
        }
        sendJson(response, 200, {
          entries: await options.cacheStore.list(parseCacheQuery(url))
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
        const cacheKey = createCacheKey2(body);
        if (options.cacheStore) {
          const cachedRecord = await options.cacheStore.get(cacheKey);
          if (cachedRecord) {
            sendJson(response, 200, toWorkerResponseFromCache(cachedRecord, (0, import_node_crypto.randomUUID)()));
            return;
          }
        }
        const requestId = (0, import_node_crypto.randomUUID)();
        const result = await options.backend.synthesize(body);
        const normalized = normalizeResult(body, result, requestId);
        if (options.cacheStore) {
          await options.cacheStore.set(
            createRuntimeCacheRecord(options.backend.id, body, result, normalized)
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
        error: error instanceof Error ? error.message : "Unknown Ora worker error."
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
    }
  };
}
async function readOraWorkerConfig(path) {
  const content = await (0, import_promises.readFile)(path, "utf8");
  return JSON.parse(content);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  OraBufferedInstrumentationSink,
  OraDocumentSession,
  OraMemoryCacheStore,
  OraMemoryCredentialStore,
  OraPlaybackOrchestrator,
  OraPlaybackTracker,
  OraRuntime,
  createEstimatedTimeline,
  createHttpOraWorkerBackend,
  createMockOraWorkerBackend,
  createOpenAiTtsProvider,
  createOraDocumentSession,
  createOraPlaybackOrchestrator,
  createOraRuntime,
  createOraWorkerServer,
  createRemoteTtsProvider,
  createSegmentsFromParagraphs,
  findCorpusEntryByKind,
  findTimedTokenAtTime,
  findTokenAtCharIndex,
  oraCorpus,
  readOraWorkerConfig,
  resolveSynthesisPlan,
  splitTextIntoParagraphs,
  tokenizeText
});
