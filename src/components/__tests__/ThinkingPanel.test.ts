import { describe, expect, it } from "vitest";
import {
  buildThinkingLog,
  type ThinkingItem,
} from "@/components/ThinkingPanel";

const tool = (params: string): ThinkingItem => ({
  type: "step",
  content: `Action: Using search_web for "${params}"...`,
});

const results = (count: number): ThinkingItem => ({
  type: "tool_results",
  label: "query",
  items: Array.from({ length: count }, (_, i) => ({
    title: `Result ${i + 1}`,
    url: `https://example.com/${i + 1}`,
    snippet: "snippet",
  })),
});

describe("buildThinkingLog", () => {
  it("marks a resolved tool call as done and attaches a result summary", () => {
    const entries = buildThinkingLog([tool("nobel prize 2023"), results(2)], false);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ kind: "tool", status: "done", label: "search_web", params: "nobel prize 2023" });
    expect(entries[1]).toMatchObject({ kind: "results", status: "done", summary: "2 results" });
  });

  it("marks a tool followed by an error step as failed", () => {
    const entries = buildThinkingLog(
      [tool("broken"), { type: "step", content: "Search encountered an issue — answering from knowledge instead." }],
      false,
    );
    expect(entries[0]).toMatchObject({ kind: "tool", status: "failed" });
    expect(entries[1]).toMatchObject({ kind: "info", status: "info" });
  });

  it("keeps an unresolved tool running while streaming", () => {
    const entries = buildThinkingLog([tool("in progress")], true);
    expect(entries[0]).toMatchObject({ status: "running" });
  });

  it("marks an unresolved tool interrupted once the stream ends", () => {
    const entries = buildThinkingLog([tool("cut off")], false);
    expect(entries[0]).toMatchObject({ status: "interrupted" });
  });

  it("renders thoughts as thinking entries", () => {
    const entries = buildThinkingLog(
      [{ type: "thought", content: "Let me consider the options." }],
      false,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: "thinking", body: "Let me consider the options." });
  });

  it("adds a results entry after the tool it belongs to", () => {
    const entries = buildThinkingLog([tool("a"), results(1)], false);
    expect(entries.map((e) => e.kind)).toEqual(["tool", "results"]);
  });

  it("reports generic narration as info entries", () => {
    const entries = buildThinkingLog(
      [{ type: "step", content: "Model emitted an unclosed action tag." }],
      false,
    );
    expect(entries[0]).toMatchObject({ kind: "info", status: "info" });
  });

  it("returns an empty log for an empty group", () => {
    expect(buildThinkingLog([], false)).toEqual([]);
  });
});
