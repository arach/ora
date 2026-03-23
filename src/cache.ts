import type {
  OraAudioAsset,
  OraCacheEntry,
  OraCacheQuery,
  OraCacheStore,
  OraCachedSynthesisRecord,
  OraSynthesisResponse,
} from "./types";

function cloneBytes(bytes?: Uint8Array) {
  return bytes ? new Uint8Array(bytes) : undefined;
}

function cloneAudio(audio?: OraAudioAsset) {
  if (!audio) {
    return undefined;
  }

  return {
    ...(audio.data ? { data: cloneBytes(audio.data) } : {}),
    ...(audio.url ? { url: audio.url } : {}),
    ...(audio.mimeType ? { mimeType: audio.mimeType } : {}),
  } satisfies OraAudioAsset;
}

function cloneResponse(response: OraSynthesisResponse): OraSynthesisResponse {
  return {
    ...response,
    ...(response.audio ? { audio: cloneAudio(response.audio) } : {}),
    ...(response.audioData ? { audioData: cloneBytes(response.audioData) } : {}),
    ...(response.metadata ? { metadata: { ...response.metadata } } : {}),
  };
}

function cloneEntry(entry: OraCacheEntry): OraCacheEntry {
  return {
    ...entry,
    ...(entry.metadata ? { metadata: { ...entry.metadata } } : {}),
  };
}

function cloneRecord(record: OraCachedSynthesisRecord): OraCachedSynthesisRecord {
  return {
    entry: cloneEntry(record.entry),
    response: cloneResponse(record.response),
  };
}

export class OraMemoryCacheStore implements OraCacheStore {
  private readonly values = new Map<string, OraCachedSynthesisRecord>();

  get(key: string) {
    const record = this.values.get(key);

    if (!record) {
      return undefined;
    }

    const now = new Date().toISOString();
    const nextRecord: OraCachedSynthesisRecord = {
      entry: {
        ...record.entry,
        hitCount: record.entry.hitCount + 1,
        lastAccessedAt: now,
        updatedAt: now,
      },
      response: cloneResponse(record.response),
    };

    this.values.set(key, nextRecord);
    return cloneRecord(nextRecord);
  }

  peek(key: string) {
    const record = this.values.get(key);
    return record ? cloneRecord(record) : undefined;
  }

  set(record: OraCachedSynthesisRecord) {
    this.values.set(record.entry.key, cloneRecord(record));
  }

  delete(key: string) {
    return this.values.delete(key);
  }

  list(query: OraCacheQuery = {}) {
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
}
