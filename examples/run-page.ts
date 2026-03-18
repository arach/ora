import {
  OraPlaybackTracker,
  createEstimatedTimeline,
  createSegmentsFromParagraphs,
  findCorpusEntryByKind,
  resolveSynthesisPlan,
  splitTextIntoParagraphs,
  tokenizeText,
} from "../src";
import type { OraCorpusKind } from "../src/corpus";

function printPage(kind: OraCorpusKind, priority: "quality" | "responsiveness" | "balanced") {
  const entry = findCorpusEntryByKind(kind);

  if (!entry) {
    throw new Error(`No corpus entry registered for kind "${kind}".`);
  }

  const paragraphs = splitTextIntoParagraphs(entry.excerpt, kind === "book" ? 280 : 220);
  const tokens = tokenizeText(entry.excerpt);
  const plan = resolveSynthesisPlan({
    provider: "openai",
    text: entry.excerpt,
    preferences: {
      priority,
      delivery: priority === "responsiveness" ? "streaming" : "buffered",
    },
  });
  const timeline = createEstimatedTimeline({
    text: entry.excerpt,
    tokens,
    durationMs:
      kind === "book"
        ? 7_500
        : kind === "white-paper"
          ? 5_800
          : 4_100,
  });
  const segments = createSegmentsFromParagraphs(paragraphs, `${kind}-page`);
  const tracker = new OraPlaybackTracker({
    text: entry.excerpt,
    tokens,
    timeline,
    segments,
  });

  const totalDurationMs = Math.round(timeline.at(-1)?.endMs ?? 0);
  const firstAudioMs =
    priority === "responsiveness" ? 180 : priority === "balanced" ? 420 : 900;

  console.log(`\n[page] ${kind} :: ${entry.id}`);
  console.log(`voice-plan: ${priority} -> ${plan.delivery} ${plan.format} ${plan.bitrateKbps}kbps`);
  console.log(`page-duration-estimate: ${totalDurationMs}ms`);
  console.log(`first-audio-estimate: ${firstAudioMs}ms`);
  console.log(`paragraphs: ${paragraphs.length}`);

  for (const paragraph of paragraphs) {
    const paragraphSnapshot = tracker.updateFromBoundary(paragraph.start, paragraph.index * 900);
    console.log(
      `  p${paragraph.index + 1}: chars=${paragraph.text.length} start=${paragraph.start} token=${paragraphSnapshot.token?.text ?? "n/a"}`,
    );
  }

  const renderSnapshot = tracker.updateFromClock(totalDurationMs / 2);
  console.log(
    `render-check: token=${renderSnapshot.token?.text ?? "n/a"} progress=${renderSnapshot.progress.toFixed(2)} segment=${renderSnapshot.segment?.id ?? "none"}`,
  );
}

printPage("book", "quality");
printPage("article", "responsiveness");
printPage("white-paper", "balanced");
