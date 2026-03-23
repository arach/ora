# API Agent Notes

## Public API

- `createOraRuntime`
- `createOpenAiTtsProvider`
- `createRemoteTtsProvider`
- `createOraWorkerServer`
- `setCredentials`
- `listVoices`
- `listProviderSummaries`
- `synthesize`
- `stream`

## Notes

- `synthesize` should return a normalized payload that works across providers.
- `listVoices` should always include a stable `id` and UI-friendly `label`.
- `stream` is optional and only required when provider supports it.
