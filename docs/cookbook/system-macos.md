# System macOS Backend

Use this when you want the fastest path to a working remote voice node on macOS.

It uses the built-in `say` command and requires no model downloads.

## Good Fit

- first remote worker smoke tests
- low-maintenance fallback voice
- environments where model setup is not ready yet

## Requirements

- macOS host
- `/usr/bin/say`
- `/usr/bin/afinfo`

## Start The Worker

```bash
node dist/worker-cli.js serve --host 0.0.0.0 --port 4021 --token your-token
```

The current system backend:

- lists installed macOS voices
- synthesizes buffered speech
- derives duration metadata from `afinfo`
- emits estimated boundary timing for streaming mode

## Notes

- output currently originates as AIFF from `say`
- if you need strict output-format fidelity, add a conversion step before returning audio
- this backend is a practical fallback even after a local model backend is installed
