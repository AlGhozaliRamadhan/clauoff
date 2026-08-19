import type { RetrievedChunk, SourceCitation } from "@/lib/rag/types";

export function buildCitations(chunks: RetrievedChunk[]): SourceCitation[] {
  return chunks.map((c, i) => ({
    n: i + 1,
    documentId: c.documentId,
    filename: c.filename,
    snippet: c.content.slice(0, 160).replace(/\s+/g, " ").trim(),
    score: c.score,
  }));
}

export function buildRagSystemMessage(chunks: RetrievedChunk[]): string {
  const lines = chunks.map((c, i) => {
    const loc = c.locLabel ? ` (${c.locLabel})` : "";
    return `[${i + 1}] ${c.filename}${loc}:\n${c.content}`;
  });
  return [
    "You are answering with a project knowledge library. Use ONLY the sources below when they are relevant. Cite sources inline as [1], [2], etc. matching the source numbers. If sources do not contain the answer, say so and answer from general knowledge without fabricated citations.",
    "",
    "Sources:",
    ...lines,
  ].join("\n");
}

export function injectRagIntoMessages(
  messages: Array<{ role: string; content: string }>,
  ragSystem: string,
): Array<{ role: string; content: string }> {
  if (messages[0]?.role === "system") {
    return [
      {
        role: "system",
        content: `${messages[0].content}\n\n${ragSystem}`,
      },
      ...messages.slice(1),
    ];
  }
  return [{ role: "system", content: ragSystem }, ...messages];
}
