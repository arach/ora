import {
  OraPlaybackTracker,
  createEstimatedTimeline,
  findCorpusEntryByKind,
  resolveSynthesisPlan,
  tokenizeText,
} from "../src";
import type { OraCorpusKind } from "../src/corpus";

function summarizeExample(kind: OraCorpusKind) {
  const entry = findCorpusEntryByKind(kind);

  if (!entry) {
    throw new Error(`No corpus entry registered for kind "${kind}".`);
  }

  const tokens = tokenizeText(entry.excerpt);
  const plan = resolveSynthesisPlan({
    provider: "openai",
    text: entry.excerpt,
    preferences:
      kind === "book"
        ? { priority: "quality", delivery: "buffered" }
        : kind === "white-paper"
          ? { priority: "balanced", delivery: "buffered" }
          : { priority: "responsiveness", delivery: "streaming" },
  });
  const timeline = createEstimatedTimeline({
    text: entry.excerpt,
    tokens,
    durationMs: kind === "book" ? 7_200 : kind === "white-paper" ? 5_000 : 3_500,
  });
  const tracker = new OraPlaybackTracker({
    text: entry.excerpt,
    tokens,
    timeline,
    segments: [
      { id: `${entry.id}-intro`, start: 0, end: Math.floor(entry.excerpt.length / 2) },
      {
        id: `${entry.id}-outro`,
        start: Math.floor(entry.excerpt.length / 2),
        end: entry.excerpt.length,
      },
    ],
  });
  const midSnapshot = tracker.updateFromClock((timeline.at(-1)?.endMs ?? 0) / 2);
  const boundarySnapshot = tracker.updateFromBoundary(Math.floor(entry.excerpt.length * 0.7), 1_800);

  return {
    kind,
    entry,
    tokens,
    plan,
    timeline,
    midSnapshot,
    boundarySnapshot,
  };
}

for (const kind of ["book", "article", "white-paper"] satisfies OraCorpusKind[]) {
  const result = summarizeExample(kind);

  console.log(`\n[${result.kind}] ${result.entry.id}`);
  console.log(`source: ${result.entry.sourceFile}`);
  console.log(`excerpt: ${result.entry.excerpt}`);
  console.log(
    `plan: priority=${result.plan.priority} delivery=${result.plan.delivery} format=${result.plan.format} bitrate=${result.plan.bitrateKbps}kbps sampleRate=${result.plan.sampleRateHz}Hz`,
  );
  console.log(
    `tokens: total=${result.tokens.length} duration=${Math.round(result.timeline.at(-1)?.endMs ?? 0)}ms`,
  );
  console.log(
    `clock snapshot: token=${result.midSnapshot.token?.text ?? "n/a"} progress=${result.midSnapshot.progress.toFixed(2)} segment=${result.midSnapshot.segment?.id ?? "none"}`,
  );
  console.log(
    `boundary snapshot: token=${result.boundarySnapshot.token?.text ?? "n/a"} char=${result.boundarySnapshot.currentCharIndex} segment=${result.boundarySnapshot.segment?.id ?? "none"}`,
  );
}
