"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { motion } from "motion/react";
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

function getParagraphTokens(paragraph: PlaygroundParagraph, tokens: PlaygroundToken[]) {
  return tokens.filter((token) => token.start >= paragraph.start && token.end <= paragraph.end);
}

function getWaveState(tokenIndex: number, tokenCount: number, progress: number) {
  if (tokenCount <= 1) {
    return { emphasis: 1, distance: 0 };
  }

  const floatIndex = progress * (tokenCount - 1);
  const distance = tokenIndex - floatIndex;
  const normalizedDistance = Math.min(Math.abs(distance) / 1.8, 1);
  const emphasis = Math.cos(normalizedDistance * Math.PI * 0.5) ** 2;

  return {
    emphasis,
    distance,
  };
}

function getTokenVisualState(distance: number, emphasis: number) {
  const proximity = Math.abs(distance);

  if (proximity < 0.45) {
    return {
      opacity: 1,
      scale: 1.035,
      y: -1.5,
      color: "rgb(255, 232, 214)",
      underlineOpacity: 0.95,
      underlineScale: 1,
      letterSpacing: "0em",
    };
  }

  if (proximity < 1.2) {
    return {
      opacity: 0.82,
      scale: 1.01,
      y: -0.4,
      color: "rgba(228, 210, 195, 0.96)",
      underlineOpacity: 0.28 + emphasis * 0.12,
      underlineScale: 0.82,
      letterSpacing: "0em",
    };
  }

  return {
    opacity: 0.56,
    scale: 1,
    y: 0,
    color: "rgba(186, 181, 175, 0.88)",
    underlineOpacity: 0,
    underlineScale: 0.72,
    letterSpacing: "0em",
  };
}

export default function PlaygroundPage() {
  const [kind, setKind] = useState<PlaygroundKind>("book");
  const [units, setUnits] = useState<PlaybackUnit[]>([]);
  const [currentUnitIndex, setCurrentUnitIndex] = useState<number | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [model, setModel] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [cacheMode, setCacheMode] = useState<"use-cache" | "bypass-cache">("use-cache");
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unitsRef = useRef<PlaybackUnit[]>([]);
  const currentUnitIndexRef = useRef<number | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);
  const data = useMemo(() => buildPlaybackState(kind), [kind]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLocalhost(
        window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1",
      );
    }
  }, []);

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
    setDisplayTime(0);
    setModel(null);
    setCacheStatus(null);
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
      setDisplayTime(audio.currentTime);
      if (!audio.paused) {
        rafRef.current = window.requestAnimationFrame(update);
      }
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
          setDisplayTime(0);
        }
      }
    };

    const pause = () => {
      setIsPlaying(false);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    const play = () => {
      setIsPlaying(true);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = window.requestAnimationFrame(update);
    };

    audio.addEventListener("ended", ended);
    audio.addEventListener("pause", pause);
    audio.addEventListener("play", play);
    audio.addEventListener("seeked", update);

    return () => {
      audio.removeEventListener("ended", ended);
      audio.removeEventListener("pause", pause);
      audio.removeEventListener("play", play);
      audio.removeEventListener("seeked", update);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  const activeParagraph =
    currentUnitIndex === null ? null : data.paragraphs[currentUnitIndex] ?? null;
  const token = findActiveToken(activeParagraph, data.tokens, audioProgress);
  const segment =
    currentUnitIndex === null ? null : data.segments[currentUnitIndex] ?? null;
  const elapsedSeconds =
    Number.isFinite(displayTime)
      ? displayTime
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
        bypassCache: cacheMode === "bypass-cache",
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
    const responseCache = response.headers.get("X-Ora-Cache");

    if (responseModel) {
      setModel(responseModel);
    }

    if (responseCache) {
      setCacheStatus(responseCache);
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

    const unit = unitsRef.current[index];
    const audioUrl = forcedUrl ?? unit?.audioUrl;

    if (!unit || !audioUrl) {
      return;
    }

    setCurrentUnitIndex(index);
    setAudioProgress(0);
    setDisplayTime(0);
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
    setDisplayTime(0);
    setCacheStatus(null);
    setIsPlaying(false);
    setPlayError(null);
  }

  function seekPlayback(event: MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;

    if (!audio || !audio.duration) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setAudioProgress(ratio);
    setDisplayTime(audio.currentTime);
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
          {cacheStatus ? <span className="playground-meta">cache: {cacheStatus}</span> : null}
          {isLocalhost ? (
            <label className="playground-toggle">
              <input
                type="checkbox"
                checked={cacheMode === "bypass-cache"}
                onChange={(event) =>
                  setCacheMode(event.target.checked ? "bypass-cache" : "use-cache")
                }
              />
              bypass cache
            </label>
          ) : null}
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

          <div
            className="playground-progress interactive"
            onClick={seekPlayback}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(audioProgress * 100)}
            aria-label="Playback progress"
          >
            <div
              className="playground-progress-fill"
              style={{ width: `${audioProgress * 100}%` }}
            />
          </div>

          <div className="playground-copy">
            {data.paragraphs.map((paragraph, index) => {
              const activeParagraph =
                currentUnitIndex === index;
              const unit = units[index];
              const paragraphTokens = getParagraphTokens(paragraph, data.tokens);
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
                  {paragraphTokens.map((token, tokenIndex) => {
                    const wave = activeParagraph
                      ? getWaveState(tokenIndex, paragraphTokens.length, audioProgress)
                      : { emphasis: 0, distance: 99 };
                    const visual = activeParagraph
                      ? getTokenVisualState(wave.distance, wave.emphasis)
                      : {
                          opacity: 0.68,
                          scale: 1,
                          y: 0,
                          color: "rgba(186, 181, 175, 0.88)",
                          underlineOpacity: 0,
                          underlineScale: 0.72,
                          letterSpacing: "0em",
                        };

                    return (
                      <motion.span
                        key={`${paragraph.index}-${token.index}`}
                        className={activeParagraph ? "token-wave" : "token"}
                        animate={{
                          opacity: visual.opacity,
                          scale: visual.scale,
                          y: visual.y,
                          color: visual.color,
                          letterSpacing: visual.letterSpacing,
                          boxShadow: `inset 0 -0.12em 0 rgba(255, 190, 140, ${visual.underlineOpacity})`,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 34,
                          mass: 0.32,
                        }}
                        style={{
                          transformOrigin: "50% 85%",
                        }}
                      >
                        {token.text}
                        {token.end < paragraph.end ? " " : ""}
                      </motion.span>
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
