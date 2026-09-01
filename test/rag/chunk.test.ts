import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/rag/chunk";

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const chunks = chunkText("hello world", {
      maxChars: 2000,
      overlapChars: 200,
    });
    expect(chunks).toEqual(["hello world"]);
  });

  it("returns empty array for blank input", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("overlaps consecutive chunks by ~10%", () => {
    const text = "a".repeat(5000);
    const chunks = chunkText(text, { maxChars: 2000, overlapChars: 200 });
    expect(chunks.length).toBeGreaterThan(2);
    const a = chunks[0];
    const b = chunks[1];
    expect(a.slice(-200)).toBe(b.slice(0, 200));
  });

  it("prefers breaking on paragraph boundaries when possible", () => {
    const text = "para one.\n\n" + "b".repeat(1800) + "\n\npara three.";
    const chunks = chunkText(text, { maxChars: 2000, overlapChars: 200 });
    expect(chunks[0].includes("para one")).toBe(true);
  });
});
