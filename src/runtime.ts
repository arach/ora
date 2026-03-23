import { createDigest } from "./hash";
import { OraMemoryCredentialStore } from "./credentials";
import { resolveSynthesisPlan } from "./synthesis-plan";
import type {
  OraAudioAsset,
  OraCacheEntry,
  OraCacheQuery,
  OraCacheStore,
  OraCachedSynthesisRecord,
  OraCredentialMap,
  OraCredentialStore,
  OraInstrumentationEvent,
  OraInstrumentationSink,
  OraProviderClient,
  OraProviderCapabilities,
  OraProviderId,
  OraProviderRequest,
  OraProviderSummary,
  OraRuntimeOptions,
  OraSynthesisContext,
  OraSynthesisRequest,
  OraSynthesisResponse,
  OraSynthesisStreamEvent,
  OraSynthesizeOptions,
  OraTtsProvider,
  OraVoice,
} from "./types";

function normalizeAudioAsset(source: {
  audio?: OraAudioAsset;
  audioData?: Uint8Array;
  audioUrl?: string;
  mimeType?: string;
}) {
  const data = source.audio?.data ?? source.audioData;
  const url = source.audio?.url ?? source.audioUrl;
  const mimeType = source.audio?.mimeType ?? source.mimeType;

  const audio =
    data || url || mimeType
      ? {
          ...(data ? { data } : {}),
          ...(url ? { url } : {}),
          ...(mimeType ? { mimeType } : {}),
        }
      : undefined;

  return {
    audio,
    ...(data ? { audioData: data } : {}),
    ...(url ? { audioUrl: url } : {}),
    ...(mimeType ? { mimeType } : {}),
  };
}

function createDefaultRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ora-${Math.random().toString(36).slice(2, 10)}`;
}

export class OraRuntime {
  private readonly providers = new Map<OraProviderId, OraTtsProvider>();
  private readonly credentialStore: OraCredentialStore;
  private readonly cacheStore: OraCacheStore | null;
  private readonly instrumentation: OraInstrumentationSink[];
  private readonly now: () => Date;
  private readonly createRequestId: () => string;

  constructor(options: OraRuntimeOptions = {}) {
    this.credentialStore = options.credentialStore ?? new OraMemoryCredentialStore();
    this.cacheStore = options.cacheStore ?? null;
    this.instrumentation = [...(options.instrumentation ?? [])];
    this.now = options.now ?? (() => new Date());
    this.createRequestId = options.createRequestId ?? createDefaultRequestId;

    for (const provider of options.providers ?? []) {
      void this.registerProvider(provider);
    }
  }

  async registerProvider(provider: OraTtsProvider) {
    this.providers.set(provider.id, provider);

    await this.emit({
      name: "provider:registered",
      provider: provider.id,
      attributes: {},
    });
  }

  getProvider(provider: OraProviderId) {
    return this.providers.get(provider) ?? null;
  }

  provider(providerId: OraProviderId): OraProviderClient {
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
        capabilities: this.getProviderCapabilities(provider),
      }),
      hasCredentials: () => this.hasCredentials(provider.id),
      getCredentials: () => this.getCredentials(provider.id),
      setCredentials: (credentials) => this.setCredentials(provider.id, credentials),
      deleteCredentials: () => this.deleteCredentials(provider.id),
      listVoices: () => this.listVoices(provider.id),
      synthesize: (request: OraProviderRequest, options) =>
        this.synthesize({ ...request, provider: provider.id }, options),
      stream: (request: OraProviderRequest, options) =>
        this.stream({ ...request, provider: provider.id }, options),
    };
  }

  providerClients() {
    return [...this.providers.keys()].map((providerId) => this.provider(providerId));
  }

  listProviders() {
    return [...this.providers.keys()];
  }

  async listProviderSummaries(): Promise<OraProviderSummary[]> {
    return this.providerClients().map((provider) => provider.summary());
  }

  async listVoices(providerId: OraProviderId): Promise<OraVoice[]> {
    const provider = this.requireProvider(providerId);

    if (!provider.listVoices) {
      return [];
    }

    const voices = await provider.listVoices();

    return voices.map((voice) => ({
      ...voice,
      provider: voice.provider ?? provider.id,
      label: voice.label || voice.id,
    }));
  }

  setCredentials(provider: OraProviderId, credentials: OraCredentialMap) {
    this.credentialStore.set(provider, credentials);
  }

  async getCacheEntry(key: string): Promise<OraCacheEntry | null> {
    if (!this.cacheStore) {
      return null;
    }

    return (await this.cacheStore.peek(key))?.entry ?? null;
  }

  async queryCache(query: OraCacheQuery = {}): Promise<OraCacheEntry[]> {
    if (!this.cacheStore) {
      return [];
    }

    return this.cacheStore.list(query);
  }

  async deleteCacheEntry(key: string) {
    if (!this.cacheStore) {
      return false;
    }

    return this.cacheStore.delete(key);
  }

  getCredentials(provider: OraProviderId) {
    return this.credentialStore.get(provider);
  }

  deleteCredentials(provider: OraProviderId) {
    return this.credentialStore.delete(provider);
  }

  hasCredentials(provider: OraProviderId) {
    return this.credentialStore.has(provider);
  }

  credentialProviders() {
    return this.credentialStore.providers();
  }

  async synthesize(request: OraSynthesisRequest, options: OraSynthesizeOptions = {}) {
    const provider = this.requireProvider(request.provider);

    const requestId = this.createRequestId();
    const credentials = this.credentialStore.get(request.provider) ?? {};
    const startedAt = this.now();
    const context = await this.createContext(request, requestId, credentials, options);
    const cacheKey = await this.resolveCacheKey(provider, request, context);

    await this.emitQueued(request, requestId, credentials, context.plan);

    const cachedRecord = cacheKey ? await this.cacheStore?.get(cacheKey) : undefined;

    if (cachedRecord) {
      const completedAt = this.now();
      const normalizedResponse = this.normalizeResponse(
        request,
        {
          ...cachedRecord.response,
          cacheKey,
          cached: true,
        },
        requestId,
        startedAt,
        completedAt,
        0,
      );

      await this.emit({
        name: "synthesis:succeeded",
        provider: request.provider,
        requestId,
        attributes: {
          cached: true,
          durationMs: normalizedResponse.durationMs,
          format: normalizedResponse.format,
        },
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
        durationMs,
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
          format: normalizedResponse.format,
        },
      });

      return normalizedResponse;
    } catch (error) {
      await this.emit({
        name: "synthesis:failed",
        provider: request.provider,
        requestId,
        attributes: {
          format: request.format ?? "mp3",
        },
        error: {
          name: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : "Unknown Ora synthesis error.",
        },
      });

      throw error;
    }
  }

  async *stream(request: OraSynthesisRequest, options: OraSynthesizeOptions = {}) {
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
        format: request.format ?? "mp3",
      },
    } satisfies OraSynthesisStreamEvent;

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
          timeMs: durationMs,
        } satisfies OraSynthesisStreamEvent;
      }

      await this.emit({
        name: "synthesis:succeeded",
        provider: request.provider,
        requestId,
        attributes: {
          durationMs,
          format: request.format ?? "mp3",
          mode: "stream",
        },
      });
    } catch (error) {
      await this.emit({
        name: "synthesis:failed",
        provider: request.provider,
        requestId,
        attributes: {
          format: request.format ?? "mp3",
          mode: "stream",
        },
        error: {
          name: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : "Unknown Ora synthesis stream error.",
        },
      });

      throw error;
    }
  }

  private getProviderCapabilities(provider: OraTtsProvider): OraProviderCapabilities {
    return {
      buffered: true,
      streaming: Boolean(provider.stream),
      voiceDiscovery: Boolean(provider.listVoices),
    };
  }

  private requireProvider(providerId: OraProviderId) {
    const provider = this.providers.get(providerId);

    if (!provider) {
      throw new Error(`No Ora provider registered for "${providerId}".`);
    }

    return provider;
  }

  private normalizeResponse(
    request: OraSynthesisRequest,
    response: OraSynthesisResponse,
    requestId: string,
    startedAt: Date,
    completedAt: Date,
    durationMs: number,
  ) {
    const normalized = {
      ...response,
      requestId,
      provider: response.provider ?? request.provider,
      voice: response.voice ?? request.voice ?? "default",
      rate: response.rate ?? request.rate ?? 1,
      format: response.format ?? request.format ?? "mp3",
      startedAt: response.startedAt ?? startedAt.toISOString(),
      completedAt: response.completedAt ?? completedAt.toISOString(),
      durationMs: response.durationMs ?? durationMs,
    };

    return {
      ...normalized,
      ...normalizeAudioAsset(normalized),
    };
  }

  private async resolveCacheKey(
    provider: OraTtsProvider,
    request: OraSynthesisRequest,
    context: OraSynthesisContext,
  ) {
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
        plan: context.plan,
      }),
    );

    return `${request.provider}:${digest}`;
  }

  private async createCacheRecord(
    key: string,
    request: OraSynthesisRequest,
    response: OraSynthesisResponse,
  ): Promise<OraCachedSynthesisRecord> {
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
        metadata: response.metadata,
      },
      response: {
        ...response,
        cached: false,
      },
    };
  }

  private normalizeStreamEvent(
    request: OraSynthesisRequest,
    requestId: string,
    event: OraSynthesisStreamEvent,
  ) {
    return {
      ...event,
      requestId,
      provider: request.provider,
      timestamp: event.timestamp ?? this.now().toISOString(),
    };
  }

  private async createContext(
    request: OraSynthesisRequest,
    requestId: string,
    credentials: OraCredentialMap,
    options: OraSynthesizeOptions,
  ) {
    const plan = resolveSynthesisPlan(request);

    return {
      requestId,
      provider: request.provider,
      credentials,
      plan,
      signal: options.signal,
      emit: (event) =>
        this.emit({
          ...event,
          provider: request.provider,
          requestId,
        }),
    } satisfies OraSynthesisContext;
  }

  private async emitQueued(
    request: OraSynthesisRequest,
    requestId: string,
    credentials: OraCredentialMap,
    plan: OraSynthesisContext["plan"],
  ) {
    await this.emit({
      name: "synthesis:queued",
      provider: request.provider,
      requestId,
      attributes: {
        format: plan.format,
        hasVoice: Boolean(request.voice),
        textLength: request.text.length,
        priority: plan.priority,
        delivery: plan.delivery,
      },
    });

    await this.emit({
      name: "credentials:resolved",
      provider: request.provider,
      requestId,
      attributes: {
        credentialCount: Object.keys(credentials).length,
      },
    });
  }

  private async emitStarted(
    request: OraSynthesisRequest,
    requestId: string,
    plan: OraSynthesisContext["plan"],
  ) {
    await this.emit({
      name: "synthesis:started",
      provider: request.provider,
      requestId,
      attributes: {
        voice: request.voice ?? null,
        bitrateKbps: plan.bitrateKbps,
        sampleRateHz: plan.sampleRateHz,
      },
    });
  }

  private async emit(event: Omit<OraInstrumentationEvent, "timestamp"> & { timestamp?: string }) {
    const normalizedEvent: OraInstrumentationEvent = {
      ...event,
      timestamp: event.timestamp ?? this.now().toISOString(),
    };

    await Promise.all(this.instrumentation.map((sink) => sink.emit(normalizedEvent)));
  }
}

export function createOraRuntime(options: OraRuntimeOptions = {}) {
  return new OraRuntime(options);
}
