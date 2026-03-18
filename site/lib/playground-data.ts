export type PlaygroundKind = "article" | "book" | "white-paper";

export type PlaygroundEntry = {
  id: string;
  kind: PlaygroundKind;
  sourceFile: string;
  excerpt: string;
};

export type PlaygroundToken = {
  index: number;
  text: string;
  start: number;
  end: number;
  isWord: boolean;
};

export type PlaygroundParagraph = {
  index: number;
  text: string;
  start: number;
  end: number;
};

export type PlaygroundSegment = {
  id: string;
  label: string;
  start: number;
  end: number;
};

export const playgroundEntries: PlaygroundEntry[] = [
  {
    id: "interpretable-ai-text-detection",
    kind: "article",
    sourceFile: "2603.15034v1.pdf",
    excerpt:
      "Tasks of machine-generated text detection and attribution increasingly appear in the form of shared tasks, such as SemEval, AuTexTification, or RuATD. Within AuTexTification 2023, the system by Przybyla et al. introduced an architecture that combined transformer-based embeddings, probabilistic features derived from language models, and traditional linguistic statistics. This approach improved performance, but it had some limitations.",
  },
  {
    id: "state-of-ai-2023",
    kind: "white-paper",
    sourceFile: "State of AI Report 2023 - ONLINE.pdf",
    excerpt:
      "Artificial intelligence is a multidisciplinary field of science and engineering whose goal is to create intelligent machines. We believe that AI will be a force multiplier on technological progress in our increasingly digital, data-driven world. This is because everything around us today, ranging from culture to consumer products, is a product of intelligence. The State of AI Report is a compilation of the most interesting things we have seen with a goal of triggering an informed conversation about the state of AI and its implication for the future.",
  },
  {
    id: "oprah-winfrey-and-the-glamour-of-misery",
    kind: "book",
    sourceFile:
      "Eva Illouz - Oprah Winfrey and the Glamour of Misery_ An Essay on Popular Culture-Columbia University Press (2003).pdf",
    excerpt:
      "The Oprah Winfrey Show has become a text of breathtaking proportions, stretching from the United States to India, Europe, Africa, and Asia. It is remarkable not only for the variety of issues it addresses, the scope of its influence, and the size of its audience, but also because few global media empires are the outcome of one person's single-handed enterprise. This is not to deny that the shrewd and aggressive marketing strategies of the King Corporation have played an important role in helping Oprah gain the upper hand in the market. But her success has been so swift, significant, and durable that the economic explanation alone will not do.",
  },
];

const tokenPattern = /\p{L}[\p{L}\p{N}'’-]*|\p{N}+|[^\s]/gu;
const sentenceBoundaryPattern = /(?<=[.!?])\s+/u;

export function getPlaygroundEntry(kind: PlaygroundKind) {
  return playgroundEntries.find((entry) => entry.kind === kind) ?? null;
}

export function tokenizeText(text: string): PlaygroundToken[] {
  const tokens: PlaygroundToken[] = [];

  for (const match of text.matchAll(tokenPattern)) {
    const raw = match[0] ?? "";
    const start = match.index ?? 0;
    const end = start + raw.length;

    tokens.push({
      index: tokens.length,
      text: raw,
      start,
      end,
      isWord: /[\p{L}\p{N}]/u.test(raw),
    });
  }

  return tokens;
}

export function splitTextIntoParagraphs(text: string, targetLength = 260): PlaygroundParagraph[] {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  const sentences = trimmed.split(sentenceBoundaryPattern).filter(Boolean);
  const paragraphs: PlaygroundParagraph[] = [];
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
  paragraphs: PlaygroundParagraph[],
  prefix = "paragraph",
): PlaygroundSegment[] {
  return paragraphs.map((paragraph) => ({
    id: `${prefix}-${paragraph.index + 1}`,
    label: `Paragraph ${paragraph.index + 1}`,
    start: paragraph.start,
    end: paragraph.end,
  }));
}

export function findTimedTokenAtProgress(tokens: PlaygroundToken[], progress: number) {
  const targetIndex = Math.min(tokens.length - 1, Math.max(0, Math.floor(progress * tokens.length)));
  return tokens[targetIndex] ?? null;
}
