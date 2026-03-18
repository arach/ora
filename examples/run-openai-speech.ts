import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  OraRuntime,
  createOpenAiTtsProvider,
  findCorpusEntryByKind,
} from "../src";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required to run this example.");
}

const entry = findCorpusEntryByKind("article");

if (!entry) {
  throw new Error("Missing article corpus entry.");
}

const runtime = new OraRuntime({
  providers: [createOpenAiTtsProvider()],
});

runtime.setCredentials("openai", { apiKey });

const response = await runtime.synthesize({
  provider: "openai",
  text: entry.excerpt,
  voice: "alloy",
  format: "mp3",
  preferences: {
    priority: "balanced",
    delivery: "buffered",
  },
});

const outputDir = resolve(process.cwd(), ".ora-output");
const outputPath = resolve(outputDir, "openai-article-sample.mp3");
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, response.audioData ?? new Uint8Array());

console.log("saved", outputPath);
console.log("model", response.metadata?.model ?? "unknown");
console.log("bytes", response.audioData?.byteLength ?? 0);
