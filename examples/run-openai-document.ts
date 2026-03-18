import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  OraDocumentSession,
  OraPlaybackOrchestrator,
  OraRuntime,
  createOpenAiTtsProvider,
  findCorpusEntryByKind,
} from "../src";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required to run this example.");
}

const entry = findCorpusEntryByKind("book");

if (!entry) {
  throw new Error("Missing book corpus entry.");
}

const runtime = new OraRuntime({
  providers: [createOpenAiTtsProvider()],
});

runtime.setCredentials("openai", { apiKey });

const session = new OraDocumentSession({
  text: entry.excerpt,
  paragraphLength: 280,
  voice: "alloy",
  preferences: {
    priority: "quality",
    delivery: "buffered",
  },
});
const orchestrator = new OraPlaybackOrchestrator({
  session: session.snapshot(),
});
const outputDir = resolve(process.cwd(), ".ora-output", "openai-book");
await mkdir(outputDir, { recursive: true });

for (const unit of session.snapshot().units.slice(0, 2)) {
  const snapshot = await orchestrator.synthesizeUnit(runtime, {
    provider: "openai",
    index: unit.index,
  });
  const synthesized = snapshot.session.units[unit.index];

  if (synthesized?.audioData) {
    await writeFile(
      resolve(outputDir, `${synthesized.id}.mp3`),
      synthesized.audioData,
    );
  }
}

console.log(orchestrator.snapshot());
