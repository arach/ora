import type { OraInstrumentationEvent, OraInstrumentationSink } from "./types";

export class OraBufferedInstrumentationSink implements OraInstrumentationSink {
  readonly events: OraInstrumentationEvent[] = [];

  emit(event: OraInstrumentationEvent) {
    this.events.push(event);
  }

  flush() {
    return [...this.events];
  }

  reset() {
    this.events.length = 0;
  }
}
