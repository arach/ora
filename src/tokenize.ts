import type { OraTextToken } from "./types";

const tokenPattern = /\p{L}[\p{L}\p{N}'’-]*|\p{N}+|[^\s]/gu;

export function tokenizeText(text: string): OraTextToken[] {
  const tokens: OraTextToken[] = [];

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

export function findTokenAtCharIndex(tokens: OraTextToken[], charIndex: number) {
  if (tokens.length === 0) {
    return null;
  }

  const clampedCharIndex = Math.max(0, charIndex);

  return (
    tokens.find((token) => clampedCharIndex >= token.start && clampedCharIndex < token.end) ??
    tokens.findLast((token) => token.start <= clampedCharIndex) ??
    tokens[0]
  );
}
