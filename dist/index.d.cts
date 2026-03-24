type OraProviderId = "openai" | "elevenlabs" | "system" | (string & {});
type OraAudioFormat = "mp3" | "wav" | "aac" | "opus" | "aiff";
type OraCredentialValue = string;
type OraCredentialMap = Record<string, OraCredentialValue>;
type OraMetadataValue = string | number | boolean | null;
type OraMetadataMap = Record<string, OraMetadataValue>;
type OraSynthesisPriority = "quality" | "balanced" | "responsiveness";
type OraSynthesisDelivery = "buffered" | "streaming" | "auto";
type OraSynthesisCacheStrategy = "full-audio" | "progressive";
type OraSynthesisPreferences = {
    priority?: OraSynthesisPriority;
    delivery?: OraSynthesisDelivery;
    bitrateKbps?: number;
    sampleRateHz?: number;
};
type OraResolvedSynthesisPlan = {
    priority: OraSynthesisPriority;
    delivery: Exclude<OraSynthesisDelivery, "auto">;
    format: OraAudioFormat;
    bitrateKbps: number;
    sampleRateHz: number;
    cacheStrategy: OraSynthesisCacheStrategy;
};
type OraSynthesisRequest = {
    provider: OraProviderId;
    text: string;
    voice?: string;
    rate?: number;
    instructions?: string;
    format?: OraAudioFormat;
    preferences?: OraSynthesisPreferences;
    metadata?: OraMetadataMap;
};
type OraAudioAsset = {
    data?: Uint8Array;
    url?: string;
    mimeType?: string;
};
type OraCacheEntry = {
    key: string;
    provider: OraProviderId | string;
    voice: string;
    format: OraAudioFormat;
    textHash: string;
    textLength: number;
    durationMs: number;
    createdAt: string;
    updatedAt: string;
    lastAccessedAt: string;
    hitCount: number;
    cached: boolean;
    hasAudioData: boolean;
    audioUrl?: string;
    mimeType?: string;
    metadata?: OraMetadataMap;
};
type OraCachedSynthesisRecord = {
    entry: OraCacheEntry;
    response: OraSynthesisResponse;
};
type OraCacheQuery = {
    provider?: OraProviderId | string;
    voice?: string;
    format?: OraAudioFormat;
    textHash?: string;
    limit?: number;
};
type OraSynthesisResponse = {
    requestId: string;
    cacheKey: string;
    provider: OraProviderId;
    voice: string;
    rate: number;
    format: OraAudioFormat;
    cached: boolean;
    audio?: OraAudioAsset;
    audioUrl?: string;
    audioData?: Uint8Array;
    mimeType?: string;
    startedAt: string;
    completedAt: string;
    durationMs: number;
    metadata?: OraMetadataMap;
};
type OraVoice = {
    id: string;
    label: string;
    provider: OraProviderId;
    locale?: string;
    styles?: string[];
    tags?: string[];
    previewText?: string;
    previewUrl?: string;
    metadata?: OraMetadataMap;
};
type OraTextToken = {
    index: number;
    text: string;
    start: number;
    end: number;
    isWord: boolean;
};
type OraTimedToken = OraTextToken & {
    startMs: number;
    endMs: number;
    weightMs: number;
};
type OraPlaybackSegment = {
    id: string;
    start: number;
    end: number;
    label?: string;
};
type OraPlaybackSource = "idle" | "boundary" | "provider-mark" | "estimated-clock";
type OraPlaybackSnapshot = {
    source: OraPlaybackSource;
    currentTimeMs: number;
    currentCharIndex: number;
    progress: number;
    token: OraTextToken | null;
    tokenIndex: number;
    segment: OraPlaybackSegment | null;
    segmentIndex: number;
};
type OraEstimatedTimelineOptions = {
    text: string;
    tokens?: OraTextToken[];
    durationMs?: number;
    charactersPerSecond?: number;
    minimumTokenMs?: number;
    punctuationPauseMs?: number;
};
type OraPlaybackTrackerOptions = {
    text: string;
    tokens?: OraTextToken[];
    timeline?: OraTimedToken[];
    segments?: OraPlaybackSegment[];
};
type OraSynthesisUnitStatus = "idle" | "queued" | "synthesizing" | "ready" | "playing" | "done" | "failed";
type OraDocumentSessionOptions = {
    text: string;
    paragraphLength?: number;
    voice?: string;
    rate?: number;
    instructions?: string;
    preferences?: OraSynthesisPreferences;
    metadata?: OraMetadataMap;
};
type OraSynthesisUnit = {
    id: string;
    index: number;
    text: string;
    start: number;
    end: number;
    voice?: string;
    rate?: number;
    instructions?: string;
    preferences?: OraSynthesisPreferences;
    metadata?: OraMetadataMap;
    status: OraSynthesisUnitStatus;
    attemptCount: number;
    audioUrl?: string;
    audioData?: Uint8Array;
    mimeType?: string;
    durationMs?: number;
    error?: string;
};
type OraDocumentSessionSnapshot = {
    text: string;
    units: OraSynthesisUnit[];
    queuedCount: number;
    synthesizingCount: number;
    readyCount: number;
    playingCount: number;
    doneCount: number;
    failedCount: number;
};
type OraPlaybackOrchestratorOptions = {
    session: {
        text: string;
        units: OraSynthesisUnit[];
    };
};
type OraSynthesizeUnitOptions = {
    provider: OraProviderId;
    index: number;
    startLatencyMs?: number;
};
type OraPlaybackOrchestratorSnapshot = {
    session: OraDocumentSessionSnapshot;
    activeUnit: OraSynthesisUnit | null;
    nextUnit: OraSynthesisUnit | null;
    bufferedUnitCount: number;
    pendingUnitCount: number;
    firstAudioMs: number | null;
    tracker: OraPlaybackSnapshot;
};
type OraInstrumentationEventName = "provider:registered" | "credentials:resolved" | "synthesis:queued" | "synthesis:started" | "synthesis:succeeded" | "synthesis:failed";
type OraInstrumentationEvent = {
    name: OraInstrumentationEventName;
    timestamp: string;
    provider?: OraProviderId;
    requestId?: string;
    attributes?: OraMetadataMap;
    error?: {
        name: string;
        message: string;
    };
};
type OraInstrumentationSink = {
    emit(event: OraInstrumentationEvent): void | Promise<void>;
};
type OraCredentialStore = {
    get(provider: OraProviderId): OraCredentialMap | undefined;
    set(provider: OraProviderId, credentials: OraCredentialMap): void;
    delete(provider: OraProviderId): boolean;
    has(provider: OraProviderId): boolean;
    providers(): OraProviderId[];
};
type OraCacheStore = {
    get(key: string): Promise<OraCachedSynthesisRecord | undefined> | OraCachedSynthesisRecord | undefined;
    peek(key: string): Promise<OraCachedSynthesisRecord | undefined> | OraCachedSynthesisRecord | undefined;
    set(record: OraCachedSynthesisRecord): Promise<void> | void;
    delete(key: string): Promise<boolean> | boolean;
    list(query?: OraCacheQuery): Promise<OraCacheEntry[]> | OraCacheEntry[];
};
type OraSynthesisContext = {
    requestId: string;
    provider: OraProviderId;
    credentials: OraCredentialMap;
    plan: OraResolvedSynthesisPlan;
    signal?: AbortSignal;
    emit(event: Omit<OraInstrumentationEvent, "provider" | "requestId" | "timestamp">): Promise<void>;
};
type OraSynthesisStreamEventType = "started" | "audio" | "boundary" | "provider-mark" | "metadata" | "completed";
type OraSynthesisStreamEvent = {
    type: OraSynthesisStreamEventType;
    requestId?: string;
    provider?: OraProviderId;
    timestamp?: string;
    audio?: Uint8Array;
    mimeType?: string;
    charIndex?: number;
    timeMs?: number;
    metadata?: OraMetadataMap;
};
type OraTtsProvider = {
    id: OraProviderId;
    label?: string;
    listVoices?(): Promise<OraVoice[]> | OraVoice[];
    getCacheKey?(request: OraSynthesisRequest, context: OraSynthesisContext): Promise<string> | string;
    synthesize(request: OraSynthesisRequest, context: OraSynthesisContext): Promise<OraSynthesisResponse>;
    stream?(request: OraSynthesisRequest, context: OraSynthesisContext): AsyncIterable<OraSynthesisStreamEvent> | Promise<AsyncIterable<OraSynthesisStreamEvent>>;
};
type OraProviderCapabilities = {
    buffered: boolean;
    streaming: boolean;
    voiceDiscovery: boolean;
};
type OraProviderSummary = {
    id: OraProviderId;
    label: string;
    hasCredentials: boolean;
    capabilities: OraProviderCapabilities;
};
type OraProviderCatalog = OraProviderSummary & {
    voices: OraVoice[];
};
type OraCatalog = {
    providers: OraProviderCatalog[];
};
type OraProviderRequest = Omit<OraSynthesisRequest, "provider">;
type OraProviderClient = {
    id: OraProviderId;
    label: string;
    raw(): OraTtsProvider;
    summary(): OraProviderSummary;
    hasCredentials(): boolean;
    getCredentials(): OraCredentialMap | undefined;
    setCredentials(credentials: OraCredentialMap): void;
    deleteCredentials(): boolean;
    listVoices(): Promise<OraVoice[]>;
    synthesize(request: OraProviderRequest, options?: OraSynthesizeOptions): Promise<OraSynthesisResponse>;
    stream(request: OraProviderRequest, options?: OraSynthesizeOptions): AsyncIterable<OraSynthesisStreamEvent>;
};
type OraRuntimeOptions = {
    providers?: OraTtsProvider[];
    credentialStore?: OraCredentialStore;
    cacheStore?: OraCacheStore;
    instrumentation?: OraInstrumentationSink[];
    now?: () => Date;
    createRequestId?: () => string;
};
type OraSynthesizeOptions = {
    signal?: AbortSignal;
};
type OraRemoteTtsProviderOptions = {
    id?: OraProviderId;
    baseUrl: string;
    apiKey?: string;
    fetch?: typeof fetch;
};
type OraWorkerAudioAsset = {
    base64?: string;
    url?: string;
    mimeType?: string;
};
type OraWorkerVoice = OraVoice;
type OraWorkerHealth = {
    ok: boolean;
    provider: string;
    voices: OraWorkerVoice[];
    capabilities: {
        streaming: boolean;
        boundaries: boolean;
    };
};
type OraWorkerSynthesisRequest = {
    text: string;
    voice?: string;
    rate?: number;
    instructions?: string;
    format?: OraAudioFormat;
    preferences?: OraSynthesisPreferences;
    plan?: OraResolvedSynthesisPlan;
    metadata?: OraMetadataMap;
};
type OraWorkerSynthesisResponse = {
    requestId: string;
    cacheKey: string;
    voice: string;
    rate: number;
    format: OraAudioFormat;
    cached: boolean;
    audio?: OraWorkerAudioAsset;
    audioBase64?: string;
    audioUrl?: string;
    mimeType?: string;
    durationMs: number;
    metadata?: OraMetadataMap;
};
type OraWorkerStreamEvent = {
    type: "started";
    requestId: string;
    metadata?: OraMetadataMap;
} | {
    type: "audio";
    audioBase64: string;
    mimeType?: string;
} | {
    type: "boundary" | "provider-mark";
    charIndex: number;
    timeMs?: number;
} | {
    type: "metadata";
    metadata?: OraMetadataMap;
} | {
    type: "completed";
    timeMs?: number;
    metadata?: OraMetadataMap;
};
type OraWorkerSynthesisResult = {
    audio?: OraAudioAsset;
    audioData?: Uint8Array;
    audioUrl?: string;
    mimeType?: string;
    voice?: string;
    rate?: number;
    format?: OraAudioFormat;
    durationMs?: number;
    cached?: boolean;
    metadata?: OraMetadataMap;
};
type OraWorkerBackend = {
    id: string;
    label?: string;
    listVoices(): Promise<OraWorkerVoice[]> | OraWorkerVoice[];
    health(): Promise<{
        ok: boolean;
    }> | {
        ok: boolean;
    };
    synthesize(request: OraWorkerSynthesisRequest): Promise<OraWorkerSynthesisResult>;
    stream?(request: OraWorkerSynthesisRequest): AsyncIterable<OraWorkerStreamEvent> | Promise<AsyncIterable<OraWorkerStreamEvent>>;
};
type OraHttpWorkerBackendOptions = {
    id?: string;
    baseUrl: string;
    model?: string;
    voice?: string;
    langCode?: string;
    fetch?: typeof fetch;
};

declare class OraMemoryCacheStore implements OraCacheStore {
    private readonly values;
    get(key: string): OraCachedSynthesisRecord | undefined;
    peek(key: string): OraCachedSynthesisRecord | undefined;
    set(record: OraCachedSynthesisRecord): void;
    delete(key: string): boolean;
    list(query?: OraCacheQuery): OraCacheEntry[];
}

declare class OraMemoryCredentialStore implements OraCredentialStore {
    private readonly values;
    get(provider: OraProviderId): {
        [x: string]: string;
    } | undefined;
    set(provider: OraProviderId, credentials: OraCredentialMap): void;
    delete(provider: OraProviderId): boolean;
    has(provider: OraProviderId): boolean;
    providers(): OraProviderId[];
}

declare class OraBufferedInstrumentationSink implements OraInstrumentationSink {
    readonly events: OraInstrumentationEvent[];
    emit(event: OraInstrumentationEvent): void;
    flush(): OraInstrumentationEvent[];
    reset(): void;
}

type OraCorpusKind = "article" | "book" | "white-paper";
type OraCorpusEntry = {
    id: string;
    kind: OraCorpusKind;
    sourceFile: string;
    excerpt: string;
};
declare const oraCorpus: OraCorpusEntry[];
declare function findCorpusEntryByKind(kind: OraCorpusKind): OraCorpusEntry | null;

type OraOpenAiSpeechModel = "gpt-4o-mini-tts" | "tts-1" | "tts-1-hd";
type OraOpenAiTtsProviderOptions = {
    apiKey?: string;
    baseUrl?: string;
    defaultVoice?: string;
    fetch?: typeof fetch;
    model?: OraOpenAiSpeechModel;
    voices?: OraVoice[];
};
declare function createOpenAiTtsProvider(options?: OraOpenAiTtsProviderOptions): OraTtsProvider;

declare function createRemoteTtsProvider(options: OraRemoteTtsProviderOptions): OraTtsProvider;

declare class OraDocumentSession {
    readonly text: string;
    readonly paragraphLength: number;
    private units;
    constructor(options: OraDocumentSessionOptions);
    listUnits(): {
        id: string;
        index: number;
        text: string;
        start: number;
        end: number;
        voice?: string;
        rate?: number;
        instructions?: string;
        preferences?: OraSynthesisPreferences;
        metadata?: OraMetadataMap;
        status: OraSynthesisUnitStatus;
        attemptCount: number;
        audioUrl?: string;
        audioData?: Uint8Array;
        mimeType?: string;
        durationMs?: number;
        error?: string;
    }[];
    getUnit(index: number): {
        id: string;
        index: number;
        text: string;
        start: number;
        end: number;
        voice?: string;
        rate?: number;
        instructions?: string;
        preferences?: OraSynthesisPreferences;
        metadata?: OraMetadataMap;
        status: OraSynthesisUnitStatus;
        attemptCount: number;
        audioUrl?: string;
        audioData?: Uint8Array;
        mimeType?: string;
        durationMs?: number;
        error?: string;
    } | null;
    queue(index: number): OraDocumentSessionSnapshot;
    startSynthesis(index: number): OraDocumentSessionSnapshot;
    markReady(index: number, audioUrl?: string): OraDocumentSessionSnapshot;
    startPlayback(index: number): OraDocumentSessionSnapshot;
    markDone(index: number): OraDocumentSessionSnapshot;
    markFailed(index: number, error: string): OraDocumentSessionSnapshot;
    reset(): OraDocumentSessionSnapshot;
    snapshot(): OraDocumentSessionSnapshot;
    private replaceUnit;
}
declare function createOraDocumentSession(options: OraDocumentSessionOptions): OraDocumentSession;

declare class OraRuntime {
    private readonly providers;
    private readonly credentialStore;
    private readonly cacheStore;
    private readonly instrumentation;
    private readonly now;
    private readonly createRequestId;
    constructor(options?: OraRuntimeOptions);
    registerProvider(provider: OraTtsProvider): Promise<void>;
    getProvider(provider: OraProviderId): OraTtsProvider | null;
    provider(providerId: OraProviderId): OraProviderClient;
    providerClients(): OraProviderClient[];
    listProviders(): OraProviderId[];
    listProviderSummaries(): Promise<OraProviderSummary[]>;
    catalog(): Promise<OraCatalog>;
    listVoices(providerId: OraProviderId): Promise<OraVoice[]>;
    setCredentials(provider: OraProviderId, credentials: OraCredentialMap): void;
    getCacheEntry(key: string): Promise<OraCacheEntry | null>;
    queryCache(query?: OraCacheQuery): Promise<OraCacheEntry[]>;
    deleteCacheEntry(key: string): Promise<boolean>;
    getCredentials(provider: OraProviderId): OraCredentialMap | undefined;
    deleteCredentials(provider: OraProviderId): boolean;
    hasCredentials(provider: OraProviderId): boolean;
    credentialProviders(): OraProviderId[];
    synthesize(request: OraSynthesisRequest, options?: OraSynthesizeOptions): Promise<{
        mimeType?: string;
        audioUrl?: string;
        audioData?: Uint8Array;
        audio: {
            mimeType?: string | undefined;
            url?: string | undefined;
            data?: Uint8Array<ArrayBufferLike> | undefined;
        } | undefined;
        requestId: string;
        provider: OraProviderId;
        voice: string;
        rate: number;
        format: OraAudioFormat;
        startedAt: string;
        completedAt: string;
        durationMs: number;
        cacheKey: string;
        cached: boolean;
        metadata?: OraMetadataMap;
    }>;
    stream(request: OraSynthesisRequest, options?: OraSynthesizeOptions): AsyncGenerator<{
        requestId: string;
        provider: OraProviderId;
        timestamp: string;
        type: OraSynthesisStreamEventType;
        audio?: Uint8Array;
        mimeType?: string;
        charIndex?: number;
        timeMs?: number;
        metadata?: OraMetadataMap;
    }, void, unknown>;
    private getProviderCapabilities;
    private requireProvider;
    private normalizeResponse;
    private resolveCacheKey;
    private createCacheRecord;
    private normalizeStreamEvent;
    private createContext;
    private emitQueued;
    private emitStarted;
    private emit;
}
declare function createOraRuntime(options?: OraRuntimeOptions): OraRuntime;

declare class OraPlaybackOrchestrator {
    private readonly text;
    private readonly tracker;
    private readonly units;
    private firstAudioMs;
    constructor(options: OraPlaybackOrchestratorOptions);
    queue(index: number): OraPlaybackOrchestratorSnapshot;
    startSynthesis(index: number, startedAtMs?: number): OraPlaybackOrchestratorSnapshot;
    markReady(index: number, audioUrl?: string): OraPlaybackOrchestratorSnapshot;
    synthesizeUnit(runtime: Pick<OraRuntime, "synthesize">, options: OraSynthesizeUnitOptions): Promise<OraPlaybackOrchestratorSnapshot>;
    synthesizeNextPending(runtime: Pick<OraRuntime, "synthesize">, provider: OraSynthesizeUnitOptions["provider"]): Promise<OraPlaybackOrchestratorSnapshot>;
    startPlayback(index: number, timeMs?: number): OraPlaybackOrchestratorSnapshot;
    advance(timeMs: number): OraPlaybackOrchestratorSnapshot;
    markDone(index: number, timeMs?: number): OraPlaybackOrchestratorSnapshot;
    markFailed(index: number, error: string): OraPlaybackOrchestratorSnapshot;
    snapshot(): OraPlaybackOrchestratorSnapshot;
    private updateUnit;
}
declare function createOraPlaybackOrchestrator(options: OraPlaybackOrchestratorOptions): OraPlaybackOrchestrator;

declare function resolveSynthesisPlan(request: OraSynthesisRequest): OraResolvedSynthesisPlan;

type OraParagraph = {
    index: number;
    text: string;
    start: number;
    end: number;
};
declare function splitTextIntoParagraphs(text: string, targetLength?: number): OraParagraph[];
declare function createSegmentsFromParagraphs(paragraphs: OraParagraph[], prefix?: string): OraPlaybackSegment[];

declare function tokenizeText(text: string): OraTextToken[];
declare function findTokenAtCharIndex(tokens: OraTextToken[], charIndex: number): OraTextToken | null;

declare function createEstimatedTimeline(options: OraEstimatedTimelineOptions): OraTimedToken[];
declare function findTimedTokenAtTime(timeline: OraTimedToken[], timeMs: number): OraTimedToken | null;

declare class OraPlaybackTracker {
    readonly text: string;
    readonly tokens: OraTextToken[];
    readonly segments: OraPlaybackSegment[];
    readonly timeline: OraTimedToken[];
    private currentTimeMs;
    private currentCharIndex;
    private source;
    constructor(options: OraPlaybackTrackerOptions);
    reset(): OraPlaybackSnapshot;
    updateFromBoundary(charIndex: number, timeMs?: number): OraPlaybackSnapshot;
    updateFromProviderMark(charIndex: number, timeMs?: number): OraPlaybackSnapshot;
    updateFromClock(timeMs: number): OraPlaybackSnapshot;
    updateFromProgress(progress: number): OraPlaybackSnapshot;
    snapshot(): OraPlaybackSnapshot;
}

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
type OraWorkerServerHandle = {
    listen(options?: {
        host?: string;
        port?: number;
    }): Promise<{
        host: string;
        port: number;
    }>;
    close(): Promise<void>;
    url(): string | null;
};
declare function createMockOraWorkerBackend(options?: {
    provider?: string;
    voice?: string;
}): OraWorkerBackend;
declare function createHttpOraWorkerBackend(options: OraHttpWorkerBackendOptions): OraWorkerBackend;
declare function createOraWorkerServer(options: OraWorkerServerOptions): OraWorkerServerHandle;
declare function readOraWorkerConfig(path: string): Promise<OraWorkerConfig>;

export { type OraAudioAsset, type OraAudioFormat, OraBufferedInstrumentationSink, type OraCacheEntry, type OraCacheQuery, type OraCacheStore, type OraCachedSynthesisRecord, type OraCatalog, type OraCredentialMap, type OraCredentialStore, type OraCredentialValue, OraDocumentSession, type OraDocumentSessionOptions, type OraDocumentSessionSnapshot, type OraEstimatedTimelineOptions, type OraHttpWorkerBackendOptions, type OraInstrumentationEvent, type OraInstrumentationEventName, type OraInstrumentationSink, OraMemoryCacheStore, OraMemoryCredentialStore, type OraMetadataMap, type OraMetadataValue, OraPlaybackOrchestrator, type OraPlaybackOrchestratorOptions, type OraPlaybackOrchestratorSnapshot, type OraPlaybackSegment, type OraPlaybackSnapshot, type OraPlaybackSource, OraPlaybackTracker, type OraPlaybackTrackerOptions, type OraProviderCapabilities, type OraProviderCatalog, type OraProviderClient, type OraProviderId, type OraProviderRequest, type OraProviderSummary, type OraRemoteTtsProviderOptions, type OraResolvedSynthesisPlan, OraRuntime, type OraRuntimeOptions, type OraSynthesisContext, type OraSynthesisDelivery, type OraSynthesisPreferences, type OraSynthesisPriority, type OraSynthesisRequest, type OraSynthesisResponse, type OraSynthesisStreamEvent, type OraSynthesisStreamEventType, type OraSynthesisUnit, type OraSynthesisUnitStatus, type OraSynthesizeOptions, type OraSynthesizeUnitOptions, type OraTextToken, type OraTimedToken, type OraTtsProvider, type OraVoice, type OraWorkerAudioAsset, type OraWorkerBackend, type OraWorkerHealth, type OraWorkerStreamEvent, type OraWorkerSynthesisRequest, type OraWorkerSynthesisResponse, type OraWorkerSynthesisResult, type OraWorkerVoice, createEstimatedTimeline, createHttpOraWorkerBackend, createMockOraWorkerBackend, createOpenAiTtsProvider, createOraDocumentSession, createOraPlaybackOrchestrator, createOraRuntime, createOraWorkerServer, createRemoteTtsProvider, createSegmentsFromParagraphs, findCorpusEntryByKind, findTimedTokenAtTime, findTokenAtCharIndex, oraCorpus, readOraWorkerConfig, resolveSynthesisPlan, splitTextIntoParagraphs, tokenizeText };
