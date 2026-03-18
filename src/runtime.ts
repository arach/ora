import { OraMemoryCredentialStore } from "./credentials";
import { resolveSynthesisPlan } from "./synthesis-plan";
import type {
  OraCredentialMap,
  OraCredentialStore,
  OraInstrumentationEvent,
  OraInstrumentationSink,
  OraProviderId,
  OraRuntimeOptions,
  OraSynthesisContext,
  OraSynthesisRequest,
  OraSynthesisResponse,
  OraSynthesisStreamEvent,
  OraSynthesizeOptions,
  OraTtsProvider,
} from "./types";

function createDefaultRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `ora-${Math.random().toString(36).slice(2, 10)}`;
}

export class OraRuntime {
  private readonly providers = new Map<OraProviderId, OraTtsProvider>();
  private readonly credentialStore: OraCredentialStore;
  private readonly instrumentation: OraInstrumentationSink[];
  private readonly now: () => Date;
  private readonly createRequestId: () => string;

  constructor(options: OraRuntimeOptions = {}) {
    this.credentialStore = options.credentialStore ?? new OraMemoryCredentialStore();
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

  listProviders() {
    return [...this.providers.keys()];
  }

  setCredentials(provider: OraProviderId, credentials: OraCredentialMap) {
    this.credentialStore.set(provider, credentials);
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
    const provider = this.providers.get(request.provider);

    if (!provider) {
      throw new Error(`No Ora provider registered for "${request.provider}".`);
    }

    const requestId = this.createRequestId();
    const credentials = this.credentialStore.get(request.provider) ?? {};
    const startedAt = this.now();
    const context = await this.createContext(request, requestId, credentials, options);

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
    const provider = this.providers.get(request.provider);

    if (!provider) {
      throw new Error(`No Ora provider registered for "${request.provider}".`);
    }

    if (!provider.stream) {
      throw new Error(`Ora provider "${request.provider}" does not implement streaming.`);
    }

    const requestId = this.createRequestId();
    const credentials = this.credentialStore.get(request.provider) ?? {};
    const startedAt = this.now();
    const context = await this.createContext(request, requestId, credentials, options);
    let completed = false;

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

  private normalizeResponse(
    request: OraSynthesisRequest,
    response: OraSynthesisResponse,
    requestId: string,
    startedAt: Date,
    completedAt: Date,
    durationMs: number,
  ) {
    return {
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
