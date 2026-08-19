export interface ChunkOptions {
  /** Default 2000 (~400–600 tokens for English prose) */
  maxChars?: number;
  /** Default 200 (~10% overlap) */
  overlapChars?: number;
}

/**
 * Split text into overlapping chunks, preferring paragraph/line/word breaks.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxChars = opts.maxChars ?? 2000;
  const overlapChars = opts.overlapChars ?? 200;
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length);
    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const breakAt = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf(" "),
      );
      if (breakAt > maxChars * 0.5) {
        end = start + breakAt;
      }
    }
    const piece = normalized.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlapChars);
    // Avoid infinite loop if overlap equals chunk size edge cases
    if (start >= end) start = end;
  }
  return chunks;
}
