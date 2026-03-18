import { createEstimatedTimeline } from "./timeline";
import { OraPlaybackTracker } from "./tracker";
import { tokenizeText } from "./tokenize";
import type { OraRuntime } from "./runtime";
import type {
  OraPlaybackOrchestratorOptions,
  OraPlaybackOrchestratorSnapshot,
  OraSynthesizeUnitOptions,
  OraSynthesisUnit,
} from "./types";

function findActiveUnit(units: OraSynthesisUnit[]) {
  return (
    units.find((unit) => unit.status === "playing") ??
    units.find((unit) => unit.status === "ready") ??
    units.find((unit) => unit.status === "synthesizing") ??
    units.find((unit) => unit.status === "queued") ??
    null
  );
}

function findNextUnit(units: OraSynthesisUnit[], activeUnit: OraSynthesisUnit | null) {
  if (!activeUnit) {
    return units.find((unit) => unit.status !== "done") ?? null;
  }

  return units.find((unit) => unit.index > activeUnit.index && unit.status !== "done") ?? null;
}

export class OraPlaybackOrchestrator {
  private readonly text: string;
  private readonly tracker: OraPlaybackTracker;
  private readonly units: OraSynthesisUnit[];
  private firstAudioMs: number | null = null;

  constructor(options: OraPlaybackOrchestratorOptions) {
    this.text = options.session.text;
    this.units = options.session.units.map((unit) => ({ ...unit }));
    const tokens = tokenizeText(this.text);
    const timeline = createEstimatedTimeline({
      text: this.text,
      tokens,
    });

    this.tracker = new OraPlaybackTracker({
      text: this.text,
      tokens,
      timeline,
      segments: this.units.map((unit) => ({
        id: unit.id,
        label: `Paragraph ${unit.index + 1}`,
        start: unit.start,
        end: unit.end,
      })),
    });
  }

  queue(index: number) {
    this.updateUnit(index, (unit) => (unit.status === "idle" ? { ...unit, status: "queued" } : unit));
    return this.snapshot();
  }

  startSynthesis(index: number, startedAtMs?: number) {
    this.updateUnit(index, (unit) => ({
      ...unit,
      status: "synthesizing",
      attemptCount: unit.attemptCount + 1,
      error: undefined,
    }));

    if (this.firstAudioMs === null && typeof startedAtMs === "number") {
      this.firstAudioMs = Math.max(0, startedAtMs);
    }

    return this.snapshot();
  }

  markReady(index: number, audioUrl?: string) {
    this.updateUnit(index, (unit) => ({
      ...unit,
      status: "ready",
      audioUrl: audioUrl ?? unit.audioUrl,
    }));
    return this.snapshot();
  }

  async synthesizeUnit(runtime: Pick<OraRuntime, "synthesize">, options: OraSynthesizeUnitOptions) {
    const unit = this.units[options.index];

    if (!unit) {
      throw new Error(`Ora playback orchestrator unit ${options.index} is out of bounds.`);
    }

    this.queue(options.index);
    this.startSynthesis(options.index, options.startLatencyMs);

    try {
      const response = await runtime.synthesize({
        provider: options.provider,
        text: unit.text,
        voice: unit.voice,
        rate: unit.rate,
        instructions: unit.instructions,
        preferences: unit.preferences,
        metadata: unit.metadata,
      });

      this.updateUnit(options.index, (current) => ({
        ...current,
        status: "ready",
        audioUrl: response.audioUrl,
        audioData: response.audioData,
        mimeType: response.mimeType,
        durationMs: response.durationMs,
        error: undefined,
      }));

      return this.snapshot();
    } catch (error) {
      this.markFailed(
        options.index,
        error instanceof Error ? error.message : "Unknown synthesis failure.",
      );
      throw error;
    }
  }

  async synthesizeNextPending(
    runtime: Pick<OraRuntime, "synthesize">,
    provider: OraSynthesizeUnitOptions["provider"],
  ) {
    const next = this.units.find((unit) => unit.status === "idle" || unit.status === "queued");

    if (!next) {
      return this.snapshot();
    }

    return this.synthesizeUnit(runtime, {
      provider,
      index: next.index,
    });
  }

  startPlayback(index: number, timeMs = 0) {
    this.units.forEach((unit, unitIndex) => {
      if (unitIndex === index) {
        unit.status = "playing";
      } else if (unit.status === "playing") {
        unit.status = "ready";
      }
    });

    const active = this.units[index];
    if (active) {
      this.tracker.updateFromBoundary(active.start, timeMs);
    }

    return this.snapshot();
  }

  advance(timeMs: number) {
    this.tracker.updateFromClock(timeMs);
    return this.snapshot();
  }

  markDone(index: number, timeMs?: number) {
    this.updateUnit(index, (unit) => ({
      ...unit,
      status: "done",
    }));

    const unit = this.units[index];
    if (unit && typeof timeMs === "number") {
      this.tracker.updateFromBoundary(unit.end, timeMs);
    }

    return this.snapshot();
  }

  markFailed(index: number, error: string) {
    this.updateUnit(index, (unit) => ({
      ...unit,
      status: "failed",
      error,
    }));
    return this.snapshot();
  }

  snapshot(): OraPlaybackOrchestratorSnapshot {
    const session = {
      text: this.text,
      units: this.units.map((unit) => ({ ...unit })),
      queuedCount: this.units.filter((unit) => unit.status === "queued").length,
      synthesizingCount: this.units.filter((unit) => unit.status === "synthesizing").length,
      readyCount: this.units.filter((unit) => unit.status === "ready").length,
      playingCount: this.units.filter((unit) => unit.status === "playing").length,
      doneCount: this.units.filter((unit) => unit.status === "done").length,
      failedCount: this.units.filter((unit) => unit.status === "failed").length,
    };
    const activeUnit = findActiveUnit(session.units);
    const nextUnit = findNextUnit(session.units, activeUnit);
    const tracker = this.tracker.snapshot();

    return {
      session,
      activeUnit,
      nextUnit,
      bufferedUnitCount: session.units.filter((unit) =>
        unit.status === "ready" || unit.status === "playing" || unit.status === "done",
      ).length,
      pendingUnitCount: session.units.filter((unit) => unit.status !== "done").length,
      firstAudioMs: this.firstAudioMs,
      tracker,
    };
  }

  private updateUnit(index: number, updater: (unit: OraSynthesisUnit) => OraSynthesisUnit) {
    const current = this.units[index];

    if (!current) {
      throw new Error(`Ora playback orchestrator unit ${index} is out of bounds.`);
    }

    this.units[index] = updater({ ...current });
  }
}

export function createOraPlaybackOrchestrator(options: OraPlaybackOrchestratorOptions) {
  return new OraPlaybackOrchestrator(options);
}
