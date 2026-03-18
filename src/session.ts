import { createSegmentsFromParagraphs, splitTextIntoParagraphs } from "./segments";
import type {
  OraDocumentSessionOptions,
  OraDocumentSessionSnapshot,
  OraSynthesisUnit,
  OraSynthesisUnitStatus,
} from "./types";

function updateUnitStatus(unit: OraSynthesisUnit, status: OraSynthesisUnitStatus, updates?: Partial<OraSynthesisUnit>) {
  return {
    ...unit,
    ...updates,
    status,
  };
}

export class OraDocumentSession {
  readonly text: string;
  readonly paragraphLength: number;

  private units: OraSynthesisUnit[];

  constructor(options: OraDocumentSessionOptions) {
    this.text = options.text;
    this.paragraphLength = options.paragraphLength ?? 260;

    const paragraphs = splitTextIntoParagraphs(options.text, this.paragraphLength);
    const segments = createSegmentsFromParagraphs(paragraphs, "unit");

    this.units = paragraphs.map((paragraph, index) => ({
      id: segments[index]?.id ?? `unit-${index + 1}`,
      index,
      text: paragraph.text,
      start: paragraph.start,
      end: paragraph.end,
      voice: options.voice,
      rate: options.rate,
      instructions: options.instructions,
      preferences: options.preferences,
      metadata: options.metadata,
      status: "idle",
      attemptCount: 0,
    }));
  }

  listUnits() {
    return this.units.map((unit) => ({ ...unit }));
  }

  getUnit(index: number) {
    const unit = this.units[index];
    return unit ? { ...unit } : null;
  }

  queue(index: number) {
    return this.replaceUnit(index, (unit) =>
      unit.status === "idle" ? updateUnitStatus(unit, "queued") : unit,
    );
  }

  startSynthesis(index: number) {
    return this.replaceUnit(index, (unit) =>
      updateUnitStatus(unit, "synthesizing", {
        attemptCount: unit.attemptCount + 1,
        error: undefined,
      }),
    );
  }

  markReady(index: number, audioUrl?: string) {
    return this.replaceUnit(index, (unit) =>
      updateUnitStatus(unit, "ready", {
        audioUrl: audioUrl ?? unit.audioUrl,
      }),
    );
  }

  startPlayback(index: number) {
    this.units = this.units.map((unit, unitIndex) =>
      unitIndex === index
        ? updateUnitStatus(unit, "playing")
        : unit.status === "playing"
          ? updateUnitStatus(unit, "ready")
          : unit,
    );

    return this.snapshot();
  }

  markDone(index: number) {
    return this.replaceUnit(index, (unit) => updateUnitStatus(unit, "done"));
  }

  markFailed(index: number, error: string) {
    return this.replaceUnit(index, (unit) =>
      updateUnitStatus(unit, "failed", {
        error,
      }),
    );
  }

  reset() {
    this.units = this.units.map((unit) => ({
      ...unit,
      status: "idle",
      attemptCount: 0,
      audioUrl: undefined,
      error: undefined,
    }));

    return this.snapshot();
  }

  snapshot(): OraDocumentSessionSnapshot {
    const units = this.listUnits();

    return {
      text: this.text,
      units,
      queuedCount: units.filter((unit) => unit.status === "queued").length,
      synthesizingCount: units.filter((unit) => unit.status === "synthesizing").length,
      readyCount: units.filter((unit) => unit.status === "ready").length,
      playingCount: units.filter((unit) => unit.status === "playing").length,
      doneCount: units.filter((unit) => unit.status === "done").length,
      failedCount: units.filter((unit) => unit.status === "failed").length,
    };
  }

  private replaceUnit(index: number, updater: (unit: OraSynthesisUnit) => OraSynthesisUnit) {
    const current = this.units[index];

    if (!current) {
      throw new Error(`Ora document session unit ${index} is out of bounds.`);
    }

    this.units[index] = updater(current);
    return this.snapshot();
  }
}

export function createOraDocumentSession(options: OraDocumentSessionOptions) {
  return new OraDocumentSession(options);
}
