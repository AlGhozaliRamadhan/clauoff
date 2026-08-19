import Database from "better-sqlite3";
import { ensureProjectDirs, getProjectDbPath } from "@/lib/rag/paths";

const MIGRATION = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending','ready','error')),
  error_message TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding BLOB NOT NULL,
  loc_label TEXT,
  UNIQUE(document_id, chunk_index)
);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  chunk_id UNINDEXED,
  filename UNINDEXED,
  tokenize = 'porter unicode61'
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
`;

const openDbs = new Map<string, Database.Database>();

export function openProjectDb(projectId: string): Database.Database {
  const existing = openDbs.get(projectId);
  if (existing) return existing;

  ensureProjectDirs(projectId);
  const db = new Database(getProjectDbPath(projectId));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(MIGRATION);
  openDbs.set(projectId, db);
  return db;
}

/** Close and drop a cached handle (e.g. after project delete). */
export function closeProjectDb(projectId: string): void {
  const db = openDbs.get(projectId);
  if (db) {
    try {
      db.close();
    } catch {
      // ignore double-close
    }
    openDbs.delete(projectId);
  }
}

export function embeddingToBlob(vec: number[]): Buffer {
  const f = new Float32Array(vec);
  return Buffer.from(f.buffer, f.byteOffset, f.byteLength);
}

export function blobToEmbedding(buf: Buffer): number[] {
  // Copy into a clean ArrayBuffer so byteOffset is always 0
  const copy = Buffer.from(buf);
  const f = new Float32Array(
    copy.buffer,
    copy.byteOffset,
    Math.floor(copy.byteLength / 4),
  );
  return Array.from(f);
}
