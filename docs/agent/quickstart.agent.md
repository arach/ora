# Quickstart Agent Notes

## Setup Loop

1. instantiate `OraRuntime`
2. `registerProvider(...)`
3. `setCredentials(...)`
4. `await listVoices(provider)` for selector population
5. `await synthesize(...)` for immediate playback
6. optionally use `stream(...)` for progressive playback
