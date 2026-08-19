import { describe, it, expect } from "vitest";
import { rrfFuse, sanitizeFtsQuery } from "../retrieve";

describe("rrfFuse", () => {
  it("boosts items appearing in both ranked lists", () => {
    const fts = [
      { id: "a", score: 10 },
      { id: "b", score: 5 },
    ];
    const vec = [
      { id: "b", score: 0.9 },
      { id: "c", score: 0.8 },
    ];
    const fused = rrfFuse(fts, vec, 60);
    expect(fused[0].id).toBe("b");
  });

  it("preserves single-list order when the other is empty", () => {
    const only = [
      { id: "x", score: 1 },
      { id: "y", score: 0.5 },
    ];
    const fused = rrfFuse(only, [], 60);
    expect(fused.map((f) => f.id)).toEqual(["x", "y"]);
  });
});

describe("sanitizeFtsQuery", () => {
  it("strips punctuation and short tokens", () => {
    expect(sanitizeFtsQuery(`What's the rate-limit?`)).toBe(
      "what OR the OR rate OR limit",
    );
  });

  it("returns empty for symbol-only input", () => {
    expect(sanitizeFtsQuery("???")).toBe("");
  });
});
