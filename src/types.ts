export type OraProviderId = "openai" | "elevenlabs" | "system" | (string & {});

export type OraAudioFormat = "mp3" | "wav" | "aac" | "opus";

export type OraCredentialValue = string;

export type OraCredentialMap = Record<string, OraCredentialValue>;

export type OraSynthesisPriority = "quality" | "balanced" | "responsiveness";

export type OraSynthesisDelivery = "buffered" | "streaming" | "auto";

export type OraSynthesisCacheStrategy = "full-audio" | "progressive";

export type OraSynthesisPreferences = {
  priority?: OraSynthesisPriority;
  delivery?: OraSynthesisDelivery;
  bitrateKbps?: number;
  sampleRateHz?: number;
};

export type OraResolvedSynthesisPlan = {
  priority: OraSynthesisPriority;
  delivery: Exclude<OraSynthesisDelivery, "auto">;
  format: OraAudioFormat;
  bitrateKbps: number;
  sampleRateHz: number;
  cacheStrategy: OraSynthesisCacheStrategy;
};

export type OraSynthesisRequest = {
  provider: OraProviderId;
  text: string;
  voice?: string;
  rate?: number;
  instructions?: string;
  format?: OraAudioFormat;
  preferences?: OraSynthesisPreferences;
  metadata?: Record<string, string | number | boolean | null>;
};

export type OraSynthesisResponse = {
  requestId: string;
  cacheKey: string;
  provider: OraProviderId;
  voice: string;
  rate: number;
  format: OraAudioFormat;
  cached: boolean;
  audioUrl: string;
  audioData?: Uint8Array;
  mimeType?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type OraTextToken = {
  index: number;
  text: string;
  start: number;
  end: number;
  isWord: boolean;
};

export type OraTimedToken = OraTextToken & {
  startMs: number;
  endMs: number;
  weightMs: number;
};

export type OraPlaybackSegment = {
  id: string;
  start: number;
  end: number;
  label?: string;
};

export type OraPlaybackSource = "idle" | "boundary" | "provider-mark" | "estimated-clock";

export type OraPlaybackSnapshot = {
  source: OraPlaybackSource;
  currentTimeMs: number;
  currentCharIndex: number;
  progress: number;
  token: OraTextToken | null;
  tokenIndex: number;
  segment: OraPlaybackSegment | null;
  segmentIndex: number;
};

export type OraEstimatedTimelineOptions = {
  text: string;
  tokens?: OraTextToken[];
  durationMs?: number;
  charactersPerSecond?: number;
  minimumTokenMs?: number;
  punctuationPauseMs?: number;
};

export type OraPlaybackTrackerOptions = {
  text: string;
  tokens?: OraTextToken[];
  timeline?: OraTimedToken[];
  segments?: OraPlaybackSegment[];
};

export type OraSynthesisUnitStatus =
  | "idle"
  | "queued"
  | "synthesizing"
  | "ready"
  | "playing"
  | "done"
  | "failed";

export type OraDocumentSessionOptions = {
  text: string;
  paragraphLength?: number;
  voice?: string;
  rate?: number;
  instructions?: string;
  preferences?: OraSynthesisPreferences;
  metadata?: Record<string, string | number | boolean | null>;
};

export type OraSynthesisUnit = {
  id: string;
  index: number;
  text: string;
  start: number;
  end: number;
  voice?: string;
  rate?: number;
  instructions?: string;
  preferences?: OraSynthesisPreferences;
  metadata?: Record<string, string | number | boolean | null>;
  status: OraSynthesisUnitStatus;
  attemptCount: number;
  audioUrl?: string;
  audioData?: Uint8Array;
  mimeType?: string;
  durationMs?: number;
  error?: string;
};

export type OraDocumentSessionSnapshot = {
  text: string;
  units: OraSynthesisUnit[];
  queuedCount: number;
  synthesizingCount: number;
  readyCount: number;
  playingCount: number;
  doneCount: number;
  failedCount: number;
};

export type OraPlaybackOrchestratorOptions = {
  session: {
    text: string;
    units: OraSynthesisUnit[];
  };
};

export type OraSynthesizeUnitOptions = {
  provider: OraProviderId;
  index: number;
  startLatencyMs?: number;
};

export type OraPlaybackOrchestratorSnapshot = {
  session: OraDocumentSessionSnapshot;
  activeUnit: OraSynthesisUnit | null;
  nextUnit: OraSynthesisUnit | null;
  bufferedUnitCount: number;
  pendingUnitCount: number;
  firstAudioMs: number | null;
  tracker: OraPlaybackSnapshot;
};

export type OraInstrumentationEventName =
  | "provider:registered"
  | "credentials:resolved"
  | "synthesis:queued"
  | "synthesis:started"
  | "synthesis:succeeded"
  | "synthesis:failed";

export type OraInstrumentationEvent = {
  name: OraInstrumentationEventName;
  timestamp: string;
  provider?: OraProviderId;
  requestId?: string;
  attributes?: Record<string, string | number | boolean | null>;
  error?: {
    name: string;
    message: string;
  };
};

export type OraInstrumentationSink = {
  emit(event: OraInstrumentationEvent): void | Promise<void>;
};

export type OraCredentialStore = {
  get(provider: OraProviderId): OraCredentialMap | undefined;
  set(provider: OraProviderId, credentials: OraCredentialMap): void;
  delete(provider: OraProviderId): boolean;
  has(provider: OraProviderId): boolean;
  providers(): OraProviderId[];
};

export type OraSynthesisContext = {
  requestId: string;
  provider: OraProviderId;
  credentials: OraCredentialMap;
  plan: OraResolvedSynthesisPlan;
  signal?: AbortSignal;
  emit(event: Omit<OraInstrumentationEvent, "provider" | "requestId" | "timestamp">): Promise<void>;
};

export type OraSynthesisStreamEventType =
  | "started"
  | "audio"
  | "boundary"
  | "provider-mark"
  | "metadata"
  | "completed";

export type OraSynthesisStreamEvent = {
  type: OraSynthesisStreamEventType;
  requestId?: string;
  provider?: OraProviderId;
  timestamp?: string;
  audio?: Uint8Array;
  mimeType?: string;
  charIndex?: number;
  timeMs?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type OraTtsProvider = {
  id: OraProviderId;
  synthesize(
    request: OraSynthesisRequest,
    context: OraSynthesisContext,
  ): Promise<OraSynthesisResponse>;
  stream?(
    request: OraSynthesisRequest,
    context: OraSynthesisContext,
  ): AsyncIterable<OraSynthesisStreamEvent> | Promise<AsyncIterable<OraSynthesisStreamEvent>>;
};

export type OraRuntimeOptions = {
  providers?: OraTtsProvider[];
  credentialStore?: OraCredentialStore;
  instrumentation?: OraInstrumentationSink[];
  now?: () => Date;
  createRequestId?: () => string;
};

export type OraSynthesizeOptions = {
  signal?: AbortSignal;
};

export type OraRemoteTtsProviderOptions = {
  id?: OraProviderId;
  baseUrl: string;
  apiKey?: string;
  fetch?: typeof fetch;
};

export type OraWorkerVoice = {
  id: string;
  label?: string;
};

export type OraWorkerHealth = {
  ok: boolean;
  provider: string;
  voices: OraWorkerVoice[];
  capabilities: {
    streaming: boolean;
    boundaries: boolean;
  };
};

export type OraWorkerSynthesisRequest = {
  text: string;
  voice?: string;
  rate?: number;
  instructions?: string;
  format?: OraAudioFormat;
  metadata?: Record<string, string | number | boolean | null>;
};

export type OraWorkerSynthesisResponse = {
  requestId: string;
  cacheKey: string;
  voice: string;
  rate: number;
  format: OraAudioFormat;
  cached: boolean;
  audioBase64?: string;
  audioUrl?: string;
  mimeType?: string;
  durationMs: number;
  metadata?: Record<string, string | number | boolean | null>;
};

export type OraWorkerStreamEvent =
  | {
      type: "started";
      requestId: string;
      metadata?: Record<string, string | number | boolean | null>;
    }
  | {
      type: "audio";
      audioBase64: string;
      mimeType?: string;
    }
  | {
      type: "boundary" | "provider-mark";
      charIndex: number;
      timeMs?: number;
    }
  | {
      type: "metadata";
      metadata?: Record<string, string | number | boolean | null>;
    }
  | {
      type: "completed";
      timeMs?: number;
      metadata?: Record<string, string | number | boolean | null>;
    };

export type OraWorkerSynthesisResult = {
  audioData?: Uint8Array;
  audioUrl?: string;
  mimeType?: string;
  durationMs?: number;
  cached?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
};

export type OraWorkerBackend = {
  id: string;
  listVoices(): Promise<OraWorkerVoice[]> | OraWorkerVoice[];
  health(): Promise<{ ok: boolean }> | { ok: boolean };
  synthesize(
    request: OraWorkerSynthesisRequest,
  ): Promise<OraWorkerSynthesisResult>;
  stream?(
    request: OraWorkerSynthesisRequest,
  ): AsyncIterable<OraWorkerStreamEvent> | Promise<AsyncIterable<OraWorkerStreamEvent>>;
};

export type OraHttpWorkerBackendOptions = {
  id?: string;
  baseUrl: string;
  model?: string;
  voice?: string;
  langCode?: string;
  fetch?: typeof fetch;
};
