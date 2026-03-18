import type { OraPlaybackSegment } from "./types";

export type OraParagraph = {
  index: number;
  text: string;
  start: number;
  end: number;
};

const sentenceBoundaryPattern = /(?<=[.!?])\s+/u;

export function splitTextIntoParagraphs(text: string, targetLength = 260): OraParagraph[] {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  const sentences = trimmed.split(sentenceBoundaryPattern).filter(Boolean);
  const paragraphs: OraParagraph[] = [];
  let paragraphText = "";
  let paragraphStart = 0;

  for (const sentence of sentences) {
    const nextText = paragraphText ? `${paragraphText} ${sentence}` : sentence;

    if (paragraphText && nextText.length > targetLength) {
      paragraphs.push({
        index: paragraphs.length,
        text: paragraphText,
        start: paragraphStart,
        end: paragraphStart + paragraphText.length,
      });
      paragraphStart += paragraphText.length + 1;
      paragraphText = sentence;
      continue;
    }

    paragraphText = nextText;
  }

  if (paragraphText) {
    paragraphs.push({
      index: paragraphs.length,
      text: paragraphText,
      start: paragraphStart,
      end: paragraphStart + paragraphText.length,
    });
  }

  return paragraphs;
}

export function createSegmentsFromParagraphs(
  paragraphs: OraParagraph[],
  prefix = "paragraph",
): OraPlaybackSegment[] {
  return paragraphs.map((paragraph) => ({
    id: `${prefix}-${paragraph.index + 1}`,
    label: `Paragraph ${paragraph.index + 1}`,
    start: paragraph.start,
    end: paragraph.end,
  }));
}
