export default {
  project: {
    name: 'ora',
    tagline: 'TypeScript-first text-to-speech runtime for providers, voices, and synthesis',
    type: 'npm-package',
    version: '0.0.1',
  },

  agent: {
    criticalContext: [
      'Ora is a text-to-speech runtime surface for provider integration, voice discovery, and synthesis.',
      'Provider and voice metadata should stay stable so host apps can build selectors and adapters against Ora.',
      'Playback tracking APIs are optional advanced surfaces, not the primary product position.',
    ],

    entryPoints: {
      api: 'src/index.ts',
      tokenize: 'src/tokenize.ts',
      timeline: 'src/timeline.ts',
      tracker: 'src/tracker.ts',
      types: 'src/types.ts',
      docs: 'docs/',
    },

    rules: [
      {
        pattern: 'tracker',
        instruction: 'Preserve the correctness ladder: boundary updates outrank provider marks, which outrank estimated clock state.',
      },
      {
        pattern: 'timeline',
        instruction: 'Treat estimated timing heuristics as configurable approximations, not truth.',
      },
      {
        pattern: 'tokenize',
        instruction: 'Character ranges and token boundaries must stay stable because downstream playback state depends on them.',
      },
    ],

    sections: ['overview', 'quickstart', 'api'],
  },

  docs: {
    path: './docs',
    output: './',
    required: ['overview', 'quickstart', 'api'],
  },

  install: {
    objective: 'Install Ora and wire provider-backed text-to-speech synthesis into a TypeScript app.',
    doneWhen: {
      command: 'bun run check',
      expectedOutput: 'completes successfully',
    },
    prerequisites: [
      'Bun or another Node-compatible package manager',
      'TypeScript project using ESM or CJS imports',
    ],
    steps: [
      {
        description: 'Add Ora to your app',
        command: 'bun add @arach/ora',
      },
      {
        description: 'Import the runtime primitives',
        command: 'import { createOraRuntime, createOpenAiTtsProvider } from "@arach/ora"',
      },
      {
        description: 'Run your local typecheck',
        command: 'bun run check',
      },
    ],
  },
}
