import type {
  OraResolvedSynthesisPlan,
  OraSynthesisDelivery,
  OraSynthesisRequest,
} from "./types";

function resolveDelivery(
  requestedDelivery: OraSynthesisDelivery | undefined,
  priority: OraResolvedSynthesisPlan["priority"],
) {
  if (requestedDelivery && requestedDelivery !== "auto") {
    return requestedDelivery;
  }

  return priority === "responsiveness" ? "streaming" : "buffered";
}

export function resolveSynthesisPlan(request: OraSynthesisRequest): OraResolvedSynthesisPlan {
  const priority = request.preferences?.priority ?? "balanced";
  const delivery = resolveDelivery(request.preferences?.delivery, priority);
  const format = request.format ?? (delivery === "streaming" ? "opus" : "mp3");

  if (priority === "quality") {
    return {
      priority,
      delivery,
      format,
      bitrateKbps: request.preferences?.bitrateKbps ?? 192,
      sampleRateHz: request.preferences?.sampleRateHz ?? 48_000,
      cacheStrategy: "full-audio",
    };
  }

  if (priority === "responsiveness") {
    return {
      priority,
      delivery,
      format,
      bitrateKbps: request.preferences?.bitrateKbps ?? 64,
      sampleRateHz: request.preferences?.sampleRateHz ?? 24_000,
      cacheStrategy: delivery === "streaming" ? "progressive" : "full-audio",
    };
  }

  return {
    priority,
    delivery,
    format,
    bitrateKbps: request.preferences?.bitrateKbps ?? 128,
    sampleRateHz: request.preferences?.sampleRateHz ?? 44_100,
    cacheStrategy: delivery === "streaming" ? "progressive" : "full-audio",
  };
}
