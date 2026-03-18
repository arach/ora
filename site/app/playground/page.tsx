"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createSegmentsFromParagraphs,
  getPlaygroundEntry,
  playgroundEntries,
  splitTextIntoParagraphs,
  tokenizeText,
} from "../../lib/playground-data";
import type { PlaygroundKind, PlaygroundParagraph, PlaygroundToken } from "../../lib/playground-data";

const exampleKinds = playgroundEntries.map((entry) => entry.kind);

type UnitStatus = "idle" | "queued" | "synthesizing" | "ready" | "playing" | "done" | "failed";

type PlaybackUnit = PlaygroundParagraph & {
  id: string;
  status: UnitStatus;
  audioUrl?: string;
  error?: string;
};

const PREFETCH_AHEAD = 1;

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

function findActiveToken(
  paragraph: PlaygroundParagraph | null,
  tokens: PlaygroundToken[],
  progress: number,
) {
  if (!paragraph) {
    return null;
  }

  const paragraphTokens = tokens.filter(
    (token) => token.start >= paragraph.start && token.end <= paragraph.end,
  );

  if (paragraphTokens.length === 0) {
    return null;
  }

  const tokenIndex = Math.min(
    paragraphTokens.length - 1,
    Math.max(0, Math.floor(progress * paragraphTokens.length)),
  );

  return paragraphTokens[tokenIndex] ?? null;
}

export default function PlaygroundPage() {
  const [kind, setKind] = useState<PlaygroundKind>("book");
  const [units, setUnits] = useState<PlaybackUnit[]>([]);
  const [currentUnitIndex, setCurrentUnitIndex] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [model, setModel] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unitsRef = useRef<PlaybackUnit[]>([]);
  const currentUnitIndexRef = useRef<number | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const data = useMemo(() => buildPlaybackState(kind), [kind]);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  useEffect(() => {
    currentUnitIndexRef.current = currentUnitIndex;
  }, [currentUnitIndex]);

  useEffect(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
    setUnits(
      data.paragraphs.map((paragraph, index) => ({
        ...paragraph,
        id: data.segments[index]?.id ?? `paragraph-${index + 1}`,
        status: "idle",
      })),
    );
    setCurrentUnitIndex(null);
    setAudioProgress(0);
    setModel(null);
    setIsPlaying(false);
    setPlayError(null);
  }, [data.paragraphs, data.segments]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const update = () => {
      const progress = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
      setAudioProgress(progress);
      setIsPlaying(!audio.paused);
    };

    const ended = async () => {
      const finishedIndex = currentUnitIndexRef.current;

      if (finishedIndex === null) {
        return;
      }

      setUnits((current) =>
        current.map((unit, index) =>
          index === finishedIndex
            ? { ...unit, status: "done" }
            : unit,
        ),
      );
      const snapshot = unitsRef.current;
      const readyIndex = snapshot.findIndex(
        (unit, index) => index > finishedIndex && unit.status === "ready",
      );

      if (readyIndex >= 0) {
        await playUnit(readyIndex);
      } else {
        const idleIndex = snapshot.findIndex(
          (unit, index) => index > finishedIndex && unit.status === "idle",
        );

        if (idleIndex >= 0) {
          try {
            const audioUrl = await synthesizeUnit(idleIndex);

            if (audioUrl) {
              await playUnit(idleIndex, audioUrl);
            }
          } catch (error) {
            setPlayError(error instanceof Error ? error.message : "Unknown playback error.");
          }
        } else {
          setCurrentUnitIndex(null);
          setIsPlaying(false);
        }
      }
    };

    const pause = () => setIsPlaying(false);
    const play = () => setIsPlaying(true);

    audio.addEventListener("timeupdate", update);
    audio.addEventListener("ended", ended);
    audio.addEventListener("pause", pause);
    audio.addEventListener("play", play);

    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("pause", pause);
      audio.removeEventListener("play", play);
    };
  }, []);

  const activeParagraph =
    currentUnitIndex === null ? null : data.paragraphs[currentUnitIndex] ?? null;
  const token = findActiveToken(activeParagraph, data.tokens, audioProgress);
  const segment =
    currentUnitIndex === null ? null : data.segments[currentUnitIndex] ?? null;
  const elapsedSeconds =
    audioRef.current && Number.isFinite(audioRef.current.currentTime)
      ? audioRef.current.currentTime
      : 0;
  const totalSeconds =
    audioRef.current && Number.isFinite(audioRef.current.duration)
      ? audioRef.current.duration
      : 0;

  async function maybePrefetchNext(fromIndex: number) {
    const current = unitsRef.current;
    const candidates = current
      .filter(
        (unit) =>
          unit.index > fromIndex &&
          (unit.status === "idle" || unit.status === "queued"),
      )
      .slice(0, PREFETCH_AHEAD);

    for (const candidate of candidates) {
      try {
        await synthesizeUnit(candidate.index);
      } catch (error) {
        setPlayError(error instanceof Error ? error.message : "Unknown prefetch error.");
        break;
      }
    }
  }

  async function synthesizeUnit(index: number) {
    const unit = unitsRef.current[index];

    if (!unit) {
      return;
    }

    if (unit.audioUrl) {
      return unit.audioUrl;
    }

    setUnits((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, status: "synthesizing", error: undefined }
          : item.status === "idle"
            ? { ...item, status: "queued" }
            : item,
      ),
    );

    const response = await fetch("/api/playground/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: unit.text,
        voice: "alloy",
        format: "mp3",
        priority: kind === "book" ? "quality" : kind === "article" ? "responsiveness" : "balanced",
      }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? "Playground synthesis failed.");
    }

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);
    objectUrlsRef.current.push(audioUrl);
    const responseModel = response.headers.get("X-Ora-Model");

    if (responseModel) {
      setModel(responseModel);
    }

    setUnits((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, status: "ready", audioUrl }
          : item,
      ),
    );

    return audioUrl;
  }

  async function generatePlayback() {
    setIsGenerating(true);
    setPlayError(null);

    try {
      const initialIndex =
        unitsRef.current.findIndex((unit) => unit.status !== "done") >= 0
          ? unitsRef.current.findIndex((unit) => unit.status !== "done")
          : 0;
      const audioUrl = await synthesizeUnit(initialIndex);

      if (audioUrl) {
        await playUnit(initialIndex, audioUrl);
        void maybePrefetchNext(initialIndex);
      }
    } catch (error) {
      setPlayError(error instanceof Error ? error.message : "Unknown playback error.");
      setUnits((current) =>
        current.map((item, index) =>
          index === current.findIndex((candidate) => candidate.status === "synthesizing")
            ? { ...item, status: "failed", error: error instanceof Error ? error.message : "Unknown error." }
            : item,
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function playUnit(index: number, forcedUrl?: string) {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const unit = units[index];
    const audioUrl = forcedUrl ?? unit?.audioUrl;

    if (!unit || !audioUrl) {
      return;
    }

    setCurrentUnitIndex(index);
    setAudioProgress(0);
    setUnits((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex < index && item.status === "playing") {
          return { ...item, status: "done" };
        }

        if (itemIndex === index) {
          return { ...item, status: "playing" };
        }

        if (item.status === "failed") {
          return item;
        }

        return item;
      }),
    );

    audio.src = audioUrl;
    await audio.play();
    void maybePrefetchNext(index);
  }

  async function togglePlayback() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!audio.src) {
      await generatePlayback();
      return;
    }

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function resetPlayback() {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];

    setUnits(
      data.paragraphs.map((paragraph, index) => ({
        ...paragraph,
        id: data.segments[index]?.id ?? `paragraph-${index + 1}`,
        status: "idle",
      })),
    );
    setCurrentUnitIndex(null);
    setAudioProgress(0);
    setIsPlaying(false);
    setPlayError(null);
  }

  return (
    <main className="playground-page">
      <section className="playground-hero wrap">
        <p className="eyebrow">Playback Playground</p>
        <h1>Run a page and inspect the tradeoffs.</h1>
        <p className="hero-sub">
          This view synthesizes paragraph audio through OpenAI, keeps a queue of unit states,
          and plays the document forward as each paragraph becomes ready.
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
        <div className="playground-actions">
          <button
            type="button"
            className="playground-run"
            onClick={() => void togglePlayback()}
            disabled={isGenerating}
          >
            {isGenerating ? "Generating..." : isPlaying ? "Pause" : "Play"}
          </button>
          <button type="button" className="playground-secondary" onClick={resetPlayback}>
            Reset
          </button>
          {model ? <span className="playground-meta">model: {model}</span> : null}
          {playError ? <span className="playground-error">{playError}</span> : null}
        </div>
        <audio ref={audioRef} preload="none" />
      </section>

      <section className="playground-grid wrap">
        <article className="playground-reader">
          <div className="playground-reader-head">
            <span>{data.entry.sourceFile}</span>
            <strong>{Math.round(audioProgress * 100)}%</strong>
          </div>

          <div className="playground-progress">
            <div
              className="playground-progress-fill"
              style={{ width: `${audioProgress * 100}%` }}
            />
          </div>

          <div className="playground-copy">
            {data.paragraphs.map((paragraph, index) => {
              const activeParagraph =
                currentUnitIndex === index;
              const activeTokenStart = token?.start ?? -1;
              const activeTokenEnd = token?.end ?? -1;
              const unit = units[index];
              const className = [
                activeParagraph ? "active-paragraph" : "",
                unit?.status ? `unit-${unit.status}` : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <p key={paragraph.index} className={className || undefined}>
                  <span className="paragraph-status">
                    {unit?.id ?? `paragraph-${index + 1}`} · {unit?.status ?? "idle"}
                  </span>
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
            <strong>{elapsedSeconds.toFixed(2)}s</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{totalSeconds.toFixed(2)}s</strong>
          </div>
          <div>
            <span>Source</span>
            <strong>{currentUnitIndex === null ? "idle" : "audio-element"}</strong>
          </div>
          <div>
            <span>Paragraphs</span>
            <strong>{data.paragraphs.length}</strong>
          </div>
          <div>
            <span>Ready Units</span>
            <strong>{units.filter((unit) => unit.status === "ready").length}</strong>
          </div>
          <div>
            <span>Done Units</span>
            <strong>{units.filter((unit) => unit.status === "done").length}</strong>
          </div>
        </aside>
      </section>
    </main>
  );
}
