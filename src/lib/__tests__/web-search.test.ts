import { describe, it, expect } from "vitest";
import {
  yearSpecificQuery,
  mergeYearBoost,
  type SearchResult,
} from "../web-search";

describe("yearSpecificQuery", () => {
  it("extracts the year and moves it to the front", () => {
    expect(yearSpecificQuery("nobel prize physics 2023 laureates")).toBe(
      "2023 nobel prize physics laureates",
    );
  });

  it("returns null when there is no 4-digit year", () => {
    expect(yearSpecificQuery("nobel prize physics laureates")).toBeNull();
  });

  it("handles year at the front", () => {
    expect(yearSpecificQuery("2023 nobel prize physics")).toBe(
      "2023 nobel prize physics",
    );
  });
});

describe("mergeYearBoost", () => {
  const generic = (url: string): SearchResult => ({
    title: "List of Nobel laureates",
    url,
    snippet: "generic",
    source: "DuckDuckGo",
  });
  const year = (url: string): SearchResult => ({
    title: "2023 Nobel Prize in Physics",
    url,
    snippet: "specific",
    source: "Wikipedia",
  });

  it("puts year-specific results ahead of generic ones", () => {
    const merged = mergeYearBoost(
      [year("wiki/2023")],
      [generic("ddg/1"), generic("ddg/2")],
      5,
    );
    expect(merged[0].url).toBe("wiki/2023");
    expect(merged[0].source).toBe("Wikipedia");
  });

  it("dedupes URLs that already exist", () => {
    const merged = mergeYearBoost(
      [year("same"), year("new")],
      [generic("same"), generic("ddg/2")],
      5,
    );
    const urls = merged.map((r) => r.url);
    expect(urls.filter((u) => u === "same")).toHaveLength(1);
    expect(merged[0].url).toBe("new");
  });

  it("respects maxResults for the generic tail", () => {
    const merged = mergeYearBoost(
      [year("wiki/2023"), year("wiki/2023b")],
      [generic("ddg/1"), generic("ddg/2"), generic("ddg/3")],
      3,
    );
    expect(merged.length).toBeLessThanOrEqual(5);
    expect(merged[0].url).toBe("wiki/2023");
  });
});
