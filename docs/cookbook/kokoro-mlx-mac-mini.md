# Kokoro On Apple Silicon

This recipe is for a Tailscale-reachable Apple Silicon Mac Mini running Kokoro through `mlx-audio`.

It is a cookbook, not a guaranteed one-command installer. The point is to give a tested path without making Ora responsible for every ML and packaging edge case on the host.

## Why This Path

For Apple Silicon, `mlx-audio` is a better fit than CUDA-first wrappers.

The tested setup here uses:

- `mlx-audio`
- `mlx-community/Kokoro-82M-bf16`
- Python 3.12 via `uv`

## Host Setup

Install `uv`:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Install Python 3.12:

```bash
~/.local/bin/uv python install 3.12
```

Create a working directory and virtualenv:

```bash
mkdir -p ~/dev/mlx-audio-kokoro
cd ~/dev/mlx-audio-kokoro
~/.local/bin/uv venv --python 3.12 .venv
```

## Python Packages

The working environment used during validation needed:

```bash
.venv/bin/python -m ensurepip --upgrade
.venv/bin/python -m pip install mlx-audio
.venv/bin/python -m pip install fastapi uvicorn webrtcvad python-multipart
.venv/bin/python -m pip install misaki num2words spacy espeakng_loader
.venv/bin/python -m pip install phonemizer-fork
.venv/bin/python -m pip install "setuptools<81"
```

Important:

- `phonemizer-fork` was required instead of upstream `phonemizer`
- pinning `setuptools<81` restored `pkg_resources`, which `webrtcvad` still imports
- avoid pulling in `spacy-curated-transformers` unless you have a specific reason; it can drag `thinc` onto an incompatible major version for `spacy 3.8`

## One-Shot Smoke Test

```bash
cd ~/dev/mlx-audio-kokoro
export PATH="$PWD/.venv/bin:$PATH"
mlx_audio.tts.generate \
  --model mlx-community/Kokoro-82M-bf16 \
  --text "Hello from Kokoro on the remote Mac Mini." \
  --voice af_heart \
  --lang_code a \
  --output_path output \
  --file_prefix smoke
```

Expected result:

- `output/smoke_000.wav`

## Start The Server

```bash
cd ~/dev/mlx-audio-kokoro
export PATH="$PWD/.venv/bin:$PATH"
mlx_audio.server --host 0.0.0.0 --port 4022 --workers 1
```

Useful endpoints:

- `GET /v1/models`
- `POST /v1/audio/speech`

## Optional Ora Worker Proxy

If you want one stable Ora worker endpoint instead of pointing clients at MLX Audio directly,
run the Ora worker in HTTP-backend mode and proxy to the local MLX Audio server:

```bash
node dist/worker-cli.js serve \
  --backend http \
  --upstream http://127.0.0.1:4022 \
  --model mlx-community/Kokoro-82M-bf16 \
  --voice af_heart \
  --lang a \
  --host 0.0.0.0 \
  --port 4023 \
  --token your-token
```

That gives you the normal Ora worker endpoints:

- `GET /health`
- `GET /v1/voices`
- `POST /v1/audio/speech`
- `POST /v1/audio/speech/stream`

while keeping Kokoro isolated behind the worker.

## Example Request

```bash
curl -sS \
  -H 'Content-Type: application/json' \
  -d '{
    "model":"mlx-community/Kokoro-82M-bf16",
    "input":"Hello from Kokoro on the remote Mac Mini.",
    "voice":"af_heart",
    "lang_code":"a",
    "response_format":"wav"
  }' \
  http://100.115.12.115:4022/v1/audio/speech \
  > kokoro.wav
```

## Observed Performance

Warm-server results from the tested M4 Mac Mini with 16 GB RAM:

- short utterance latency: about `641 ms` for a `7.5 s` clip
- article-length generation: about `14x` to `15x` realtime

These are practical application-level numbers, not isolated kernel benchmarks.

## Integration Guidance

Recommended product shape:

- keep Ora’s worker/provider contract stable
- treat MLX/Kokoro as a documented backend recipe
- Ora can proxy to MLX Audio as an HTTP backend, instead of hard-coding all ML setup into Ora itself
