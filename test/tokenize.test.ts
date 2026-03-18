import { describe, expect, test } from "bun:test";
import { findTokenAtCharIndex, tokenizeText } from "../src/tokenize";

describe("tokenizeText", () => {
  test("splits words, numbers, and punctuation into stable ranges", () => {
    const text = "Hello, world! It's 2026.";
    const tokens = tokenizeText(text);

    expect(tokens.map((token) => token.text)).toEqual([
      "Hello",
      ",",
      "world",
      "!",
      "It's",
      "2026",
      ".",
    ]);

    expect(tokens.map((token) => [token.start, token.end])).toEqual([
      [0, 5],
      [5, 6],
      [7, 12],
      [12, 13],
      [14, 18],
      [19, 23],
      [23, 24],
    ]);
  });

  test("finds tokens from in-range, negative, and trailing character positions", () => {
    const tokens = tokenizeText("One two.");

    expect(findTokenAtCharIndex(tokens, 1)?.text).toBe("One");
    expect(findTokenAtCharIndex(tokens, -10)?.text).toBe("One");
    expect(findTokenAtCharIndex(tokens, 7)?.text).toBe(".");
    expect(findTokenAtCharIndex(tokens, 100)?.text).toBe(".");
  });

  test("returns null for empty token lists", () => {
    expect(findTokenAtCharIndex([], 0)).toBeNull();
  });
});
