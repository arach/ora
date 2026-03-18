import { describe, expect, test } from "bun:test";
import { createSegmentsFromParagraphs, splitTextIntoParagraphs } from "../src";

describe("splitTextIntoParagraphs", () => {
  test("groups sentence streams into paragraph-sized ranges", () => {
    const text =
      "One short sentence. Two short sentence. Three short sentence. Four short sentence.";

    const paragraphs = splitTextIntoParagraphs(text, 35);

    expect(paragraphs.length).toBeGreaterThan(1);
    expect(paragraphs[0]?.start).toBe(0);
    expect(paragraphs.at(-1)?.end).toBe(text.length);
    expect(paragraphs.every((paragraph) => paragraph.text.length > 0)).toBe(true);
  });
});

describe("createSegmentsFromParagraphs", () => {
  test("converts paragraphs into tracker-ready segments", () => {
    const paragraphs = splitTextIntoParagraphs(
      "Alpha sentence. Beta sentence. Gamma sentence.",
      24,
    );
    const segments = createSegmentsFromParagraphs(paragraphs, "page");

    expect(segments.map((segment) => segment.id)).toEqual(["page-1", "page-2", "page-3"]);
    expect(segments[0]?.label).toBe("Paragraph 1");
    expect(segments.at(-1)?.end).toBe(paragraphs.at(-1)?.end);
  });
});
