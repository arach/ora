import { NextResponse } from "next/server";
import { resolveOpenAiApiKey, synthesizeOpenAiSpeech } from "../../../../lib/openai-speech";

export async function POST(request: Request) {
  const apiKey = resolveOpenAiApiKey();

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "OPENAI_API_KEY is not configured for the playground route.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    text?: string;
    voice?: string;
    format?: "mp3" | "wav" | "aac" | "opus";
    priority?: "quality" | "balanced" | "responsiveness";
    instructions?: string;
    bypassCache?: boolean;
  };

  if (!body.text?.trim()) {
    return NextResponse.json(
      {
        error: "Text is required.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await synthesizeOpenAiSpeech({
      apiKey,
      text: body.text,
      voice: body.voice,
      format: body.format,
      priority: body.priority,
      instructions: body.instructions,
      cacheMode: body.bypassCache ? "bypass-cache" : "use-cache",
    });

    return new NextResponse(result.data, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "X-Ora-Model": result.model,
        "X-Ora-Cache": result.cache,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown speech error.",
      },
      { status: 500 },
    );
  }
}
