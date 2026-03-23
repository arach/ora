# Ora Overview

## Purpose

Ora is a small TypeScript runtime for text-to-speech provider abstraction and synthesis orchestration.

## Core Surfaces

- `createOraRuntime`
- `synthesize` / `stream`
- `listVoices`
- `listProviderSummaries`

## Constraints

- Keep provider details isolated from app UX code.
- Keep voice metadata deterministic and normalized.
- Keep synthesis response contracts stable across providers.
