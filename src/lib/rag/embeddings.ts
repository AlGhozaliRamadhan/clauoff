/**
 * OpenAI-compatible embeddings against the active backend profile.
 * Same auth pattern as OpenAiClient (ADR-0005).
 */

import { getActiveBackendConfig } from "@/lib/api-profiles";

const BATCH_SIZE = 16;

export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL || "text-embedding-3-small";
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Resolve the active backend from the runtime config (same source as
  // /api/chat), so embeddings always target the configured API — never a
  // stale hardcoded value.
  const cfg = getActiveBackendConfig();
  const baseUrl = (cfg.backendUrl || "").replace(/\/+$/, "");
  const model = getEmbeddingModel();
  const apiKey = cfg.apiKey;

  if (!baseUrl) {
    throw new Error("BACKEND_BASE_URL is required for embeddings.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, input: batch }),
    });

    if (!res.ok) {
      let t = await res.text().catch(() => "");
      if (t.trim().startsWith('<')) {
        t = 'HTML error response received (possibly a proxy or Cloudflare block).';
      }
      throw new Error(`Embeddings error ${res.status}: ${t}`);
    }

    const json = (await res.json()) as {
      data?: Array<{ embedding: number[]; index: number }>;
    };
    const rows = (json.data ?? [])
      .slice()
      .sort((a, b) => a.index - b.index);

    if (rows.length !== batch.length) {
      throw new Error(
        `Embeddings response size mismatch: expected ${batch.length}, got ${rows.length}.`,
      );
    }

    for (const row of rows) {
      if (!Array.isArray(row.embedding) || row.embedding.length === 0) {
        throw new Error("Embeddings response contained an empty vector.");
      }
      out.push(row.embedding);
    }
  }

  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
