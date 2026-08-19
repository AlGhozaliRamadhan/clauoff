import fs from "node:fs";
import path from "node:path";
import { chunkText } from "@/lib/rag/chunk";
import {
  blobToEmbedding,
  embeddingToBlob,
  openProjectDb,
} from "@/lib/rag/db";
import { embedTexts, getEmbeddingModel } from "@/lib/rag/embeddings";
import { extractText } from "@/lib/rag/extract";
import {
  ensureProjectDirs,
  getProjectFilesDir,
  safeFilename,
} from "@/lib/rag/paths";
import { getProject, touchProjectMeta } from "@/lib/rag/projects";
import type { IngestResult, ProjectDocument } from "@/lib/rag/types";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function generateDocId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `doc-${Date.now().toString(36)}-${rand}`;
}

function generateChunkId(docId: string, index: number): string {
  return `${docId}-c${index}`;
}

export async function ingestFile(
  projectId: string,
  file: { buffer: Buffer; filename: string; mimeType: string },
): Promise<IngestResult> {
  if (file.buffer.byteLength > MAX_BYTES) {
    throw new Error("File exceeds the 10 MB upload limit.");
  }

  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  ensureProjectDirs(projectId);
  const db = openProjectDb(projectId);
  const docId = generateDocId();
  const createdAt = Date.now();
  const storedName = `${docId}__${safeFilename(file.filename)}`;
  const filePath = path.join(getProjectFilesDir(projectId), storedName);

  const pending: ProjectDocument = {
    id: docId,
    projectId,
    filename: file.filename,
    mimeType: file.mimeType || "application/octet-stream",
    byteSize: file.buffer.byteLength,
    chunkCount: 0,
    status: "pending",
    createdAt,
  };

  db.prepare(
    `INSERT INTO documents (id, filename, mime_type, byte_size, chunk_count, status, error_message, created_at)
     VALUES (@id, @filename, @mime_type, @byte_size, 0, 'pending', NULL, @created_at)`,
  ).run({
    id: docId,
    filename: file.filename,
    mime_type: pending.mimeType,
    byte_size: pending.byteSize,
    created_at: createdAt,
  });

  try {
    fs.writeFileSync(filePath, file.buffer);

    const text = await extractText(
      file.buffer,
      file.filename,
      pending.mimeType,
    );
    const pieces = chunkText(text);
    if (pieces.length === 0) {
      throw new Error("No text content to index after extraction.");
    }

    const embeddings = await embedTexts(pieces);
    if (embeddings.length !== pieces.length) {
      throw new Error("Embedding count did not match chunk count.");
    }

    const dims = embeddings[0]?.length ?? 0;
    if (dims === 0) {
      throw new Error("Received empty embedding vector.");
    }

    // Dimension / model consistency for this project
    if (project.embeddingDims && project.embeddingDims !== dims) {
      throw new Error(
        `Embedding dimensions changed (${project.embeddingDims} → ${dims}). Reindex the project or keep EMBEDDING_MODEL stable.`,
      );
    }

    const model = getEmbeddingModel();
    const insertChunk = db.prepare(
      `INSERT INTO chunks (id, document_id, chunk_index, content, embedding, loc_label)
       VALUES (@id, @document_id, @chunk_index, @content, @embedding, @loc_label)`,
    );
    const insertFts = db.prepare(
      `INSERT INTO chunks_fts (content, chunk_id, filename)
       VALUES (@content, @chunk_id, @filename)`,
    );

    const tx = db.transaction(() => {
      for (let i = 0; i < pieces.length; i++) {
        const chunkId = generateChunkId(docId, i);
        insertChunk.run({
          id: chunkId,
          document_id: docId,
          chunk_index: i,
          content: pieces[i],
          embedding: embeddingToBlob(embeddings[i]),
          loc_label: `chunk ${i + 1}`,
        });
        insertFts.run({
          content: pieces[i],
          chunk_id: chunkId,
          filename: file.filename,
        });
      }
      db.prepare(
        `UPDATE documents SET status = 'ready', chunk_count = ?, error_message = NULL WHERE id = ?`,
      ).run(pieces.length, docId);
    });
    tx();

    touchProjectMeta(projectId, {
      embeddingModel: model,
      embeddingDims: dims,
      documentCountDelta: 1,
    });

    // Verify blob round-trip on first vector (dev safety; cheap)
    void blobToEmbedding(embeddingToBlob(embeddings[0]));

    const document: ProjectDocument = {
      ...pending,
      chunkCount: pieces.length,
      status: "ready",
    };

    return { document, chunkCount: pieces.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    db.prepare(
      `UPDATE documents SET status = 'error', error_message = ? WHERE id = ?`,
    ).run(message, docId);
    throw err instanceof Error ? err : new Error(message);
  }
}
