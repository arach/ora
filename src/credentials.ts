import type { OraCredentialMap, OraCredentialStore, OraProviderId } from "./types";

export class OraMemoryCredentialStore implements OraCredentialStore {
  private readonly values = new Map<OraProviderId, OraCredentialMap>();

  get(provider: OraProviderId) {
    const credentials = this.values.get(provider);
    return credentials ? { ...credentials } : undefined;
  }

  set(provider: OraProviderId, credentials: OraCredentialMap) {
    this.values.set(provider, { ...credentials });
  }

  delete(provider: OraProviderId) {
    return this.values.delete(provider);
  }

  has(provider: OraProviderId) {
    return this.values.has(provider);
  }

  providers() {
    return [...this.values.keys()];
  }
}
