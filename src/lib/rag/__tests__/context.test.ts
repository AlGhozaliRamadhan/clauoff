import { describe, it, expect } from "vitest";
import {
  buildCitations,
  buildRagSystemMessage,
  injectRagIntoMessages,
} from "../context";
import type { RetrievedChunk } from "../types";

const sample: RetrievedChunk[] = [
  {
    chunkId: "c1",
    documentId: "d1",
    filename: "readme.md",
    content: "Cogito is an offline chat app.",
    score: 0.9,
  },
  {
    chunkId: "c2",
    documentId: "d2",
    filename: "notes.txt",
    content: "Projects hold document libraries.",
    score: 0.7,
    locLabel: "chunk 2",
  },
];

describe("buildCitations", () => {
  it("numbers sources from 1 and trims snippets", () => {
    const cites = buildCitations(sample);
    expect(cites).toHaveLength(2);
    expect(cites[0].n).toBe(1);
    expect(cites[0].filename).toBe("readme.md");
    expect(cites[1].n).toBe(2);
  });
});

describe("buildRagSystemMessage", () => {
  it("includes citation instructions and numbered sources", () => {
    const msg = buildRagSystemMessage(sample);
    expect(msg).toContain("Cite sources inline as [1], [2]");
    expect(msg).toContain("[1] readme.md:");
    expect(msg).toContain("[2] notes.txt (chunk 2):");
    expect(msg).toContain("Cogito is an offline chat app.");
  });
});

describe("injectRagIntoMessages", () => {
  it("unshifts a system message when none exists", () => {
    const out = injectRagIntoMessages(
      [{ role: "user", content: "hi" }],
      "RAG BLOCK",
    );
    expect(out[0]).toEqual({ role: "system", content: "RAG BLOCK" });
    expect(out[1].role).toBe("user");
  });

  it("appends to an existing system message", () => {
    const out = injectRagIntoMessages(
      [
        { role: "system", content: "base" },
        { role: "user", content: "hi" },
      ],
      "RAG BLOCK",
    );
    expect(out[0].content).toContain("base");
    expect(out[0].content).toContain("RAG BLOCK");
    expect(out).toHaveLength(2);
  });
});
