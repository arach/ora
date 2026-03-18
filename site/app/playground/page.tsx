"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createSegmentsFromParagraphs,
  findTimedTokenAtProgress,
  getPlaygroundEntry,
  playgroundEntries,
  splitTextIntoParagraphs,
  tokenizeText,
} from "../../lib/playground-data";
import type { PlaygroundKind } from "../../lib/playground-data";

const exampleKinds = playgroundEntries.map((entry) => entry.kind);

function buildPlaybackState(kind: PlaygroundKind) {
  const entry = getPlaygroundEntry(kind);

  if (!entry) {
    throw new Error(`Missing corpus entry for ${kind}`);
  }

  const paragraphs = splitTextIntoParagraphs(entry.excerpt, kind === "book" ? 280 : 220);
  const tokens = tokenizeText(entry.excerpt);
  const totalDurationMs = kind === "book" ? 7_500 : kind === "white-paper" ? 5_800 : 4_100;
  const segments = createSegmentsFromParagraphs(paragraphs, `${kind}-page`);

  return { entry, paragraphs, tokens, totalDurationMs, segments };
}

export default function PlaygroundPage() {
  const [kind, setKind] = useState<PlaygroundKind>("book");
  const [timeMs, setTimeMs] = useState(0);
  const data = useMemo(() => buildPlaybackState(kind), [kind]);
  const totalDurationMs = data.totalDurationMs;
  const progress = totalDurationMs > 0 ? timeMs / totalDurationMs : 0;
  const token = findTimedTokenAtProgress(data.tokens, progress);
  const segment =
    data.segments.find((item) => token && token.start >= item.start && token.end <= item.end) ?? null;

  useEffect(() => {
    setTimeMs(0);
  }, [kind]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimeMs((current) => (current >= totalDurationMs ? 0 : current + 120));
    }, 120);

    return () => window.clearInterval(interval);
  }, [totalDurationMs]);

  return (
    <main className="playground-page">
      <section className="playground-hero wrap">
        <p className="eyebrow">Playback Playground</p>
        <h1>Run a page and inspect the tradeoffs.</h1>
        <p className="hero-sub">
          This view simulates a page-sized passage, breaks it into paragraph segments, and
          animates estimated playback so we can reason about rendering before wiring a live
          provider.
        </p>
        <div className="playground-switches">
          {exampleKinds.map((option) => (
            <button
              key={option}
              type="button"
              className={option === kind ? "playground-chip active" : "playground-chip"}
              onClick={() => setKind(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </section>

      <section className="playground-grid wrap">
        <article className="playground-reader">
          <div className="playground-reader-head">
            <span>{data.entry.sourceFile}</span>
            <strong>{Math.round(progress * 100)}%</strong>
          </div>

          <div className="playground-progress">
            <div
              className="playground-progress-fill"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div className="playground-copy">
            {data.paragraphs.map((paragraph) => {
              const activeParagraph =
                segment?.start === paragraph.start && segment?.end === paragraph.end;
              const activeTokenStart = token?.start ?? -1;
              const activeTokenEnd = token?.end ?? -1;

              return (
                <p key={paragraph.index} className={activeParagraph ? "active-paragraph" : undefined}>
                  {data.tokens
                    .filter(
                      (token) => token.start >= paragraph.start && token.end <= paragraph.end,
                    )
                    .map((token) => {
                      const isActive = token.start === activeTokenStart && token.end === activeTokenEnd;

                      return (
                        <span
                          key={`${paragraph.index}-${token.index}`}
                          className={isActive ? "active-token" : "token"}
                        >
                          {token.text}
                          {token.end < paragraph.end ? " " : ""}
                        </span>
                      );
                    })}
                </p>
              );
            })}
          </div>
        </article>

        <aside className="playground-panel">
          <div>
            <span>Active Token</span>
            <strong>{token?.text ?? "n/a"}</strong>
          </div>
          <div>
            <span>Segment</span>
            <strong>{segment?.label ?? "n/a"}</strong>
          </div>
          <div>
            <span>Elapsed</span>
            <strong>{(timeMs / 1000).toFixed(2)}s</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{(totalDurationMs / 1000).toFixed(2)}s</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>estimated-clock</strong>
          </div>
          <div>
            <span>Paragraphs</span>
            <strong>{data.paragraphs.length}</strong>
          </div>
        </aside>
      </section>
    </main>
  );
}
