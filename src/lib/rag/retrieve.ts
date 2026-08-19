import {
  blobToEmbedding,
  openProjectDb,
} from "@/lib/rag/db";
import { cosineSimilarity, embedTexts } from "@/lib/rag/embeddings";
import type { RetrievedChunk, RetrieveOptions } from "@/lib/rag/types";

export interface RankedId {
  id: string;
  score: number;
}

/**
 * Reciprocal Rank Fusion over two ranked id lists.
 * rank is 0-based; score contribution = 1 / (k + rank + 1).
 */
export function rrfFuse(
  listA: RankedId[],
  listB: RankedId[],
  k = 60,
): RankedId[] {
  const scores = new Map<string, number>();
  listA.forEach((item, rank) => {
    scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + rank + 1));
  });
  listB.forEach((item, rank) => {
    scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + rank + 1));
  });
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

/** Keep alphanumerics; join tokens for FTS5 MATCH (avoid query syntax errors). */
export function sanitizeFtsQuery(query: string): string {
  const tokens = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
  // Join tokens with OR so conversational queries match chunks containing at least some of the terms
  return tokens.join(" OR ");
}

export async function retrieve(
  opts: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const topK = opts.topK ?? 8;
  const candidateK = opts.candidateK ?? 20;
  const query = opts.query.trim();
  if (!query) return [];

  const db = openProjectDb(opts.projectId);

  // --- Dense channel ---
  let queryVec: number[] = [];
  try {
    const [vec] = await embedTexts([query]);
    queryVec = vec ?? [];
  } catch {
    // Dense channel fails → rely on FTS only
    queryVec = [];
  }

  const denseRanked: RankedId[] = [];
  if (queryVec.length > 0) {
    const rows = db
      .prepare(`SELECT id, embedding FROM chunks`)
      .all() as Array<{ id: string; embedding: Buffer }>;

    const scored: RankedId[] = [];
    for (const row of rows) {
      const emb = blobToEmbedding(row.embedding);
      if (emb.length !== queryVec.length) continue;
      scored.push({ id: row.id, score: cosineSimilarity(queryVec, emb) });
    }
    scored.sort((a, b) => b.score - a.score);
    denseRanked.push(...scored.slice(0, candidateK));
  }

  // --- FTS / BM25 channel ---
  const ftsQuery = sanitizeFtsQuery(query);
  const ftsRanked: RankedId[] = [];
  if (ftsQuery) {
    try {
      // bm25() lower is better in FTS5; invert for ranking display only —
      // RRF uses rank position, not raw score magnitude.
      const ftsRows = db
        .prepare(
          `SELECT chunk_id AS id, bm25(chunks_fts) AS rank
           FROM chunks_fts
           WHERE chunks_fts MATCH ?
           ORDER BY rank
           LIMIT ?`,
        )
        .all(ftsQuery, candidateK) as Array<{ id: string; rank: number }>;

      ftsRows.forEach((row, i) => {
        ftsRanked.push({ id: row.id, score: -row.rank }); // higher better for debug
        void i;
      });
    } catch {
      // MATCH syntax edge cases — skip FTS
    }
  }

  if (denseRanked.length === 0 && ftsRanked.length === 0) {
    return [];
  }

  const fused =
    denseRanked.length > 0 && ftsRanked.length > 0
      ? rrfFuse(ftsRanked, denseRanked, 60)
      : denseRanked.length > 0
        ? denseRanked
        : ftsRanked;

  const top = fused.slice(0, topK);
  if (top.length === 0) return [];

  const hydrate = db.prepare(
    `SELECT c.id AS chunk_id, c.document_id, c.content, c.loc_label, d.filename
     FROM chunks c
     JOIN documents d ON d.id = c.document_id
     WHERE c.id = ?`,
  );

  const results: RetrievedChunk[] = [];
  for (const item of top) {
    const row = hydrate.get(item.id) as
      | {
          chunk_id: string;
          document_id: string;
          content: string;
          loc_label: string | null;
          filename: string;
        }
      | undefined;
    if (!row) continue;
    results.push({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      filename: row.filename,
      content: row.content,
      score: item.score,
      locLabel: row.loc_label ?? undefined,
    });
  }

  return results;
}
