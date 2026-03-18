import {
  OraDocumentSession,
  OraPlaybackOrchestrator,
  findCorpusEntryByKind,
} from "../src";

const entry = findCorpusEntryByKind("book");

if (!entry) {
  throw new Error("Missing book corpus entry.");
}

const session = new OraDocumentSession({
  text: entry.excerpt,
  paragraphLength: 280,
  voice: "alloy",
  preferences: { priority: "quality" },
});
const orchestrator = new OraPlaybackOrchestrator({
  session: session.snapshot(),
});

for (const unit of session.snapshot().units) {
  orchestrator.queue(unit.index);
  orchestrator.startSynthesis(unit.index, 180 + unit.index * 120);
  orchestrator.markReady(unit.index, `https://example.com/unit-${unit.index + 1}.mp3`);

  if (unit.index === 0) {
    orchestrator.startPlayback(unit.index, 400);
  }
}

console.log("[orchestrator] initial");
console.log(orchestrator.snapshot());

orchestrator.markDone(0, 1800);
orchestrator.startPlayback(1, 1900);
orchestrator.advance(2400);

console.log("\n[orchestrator] after handoff");
console.log(orchestrator.snapshot());
