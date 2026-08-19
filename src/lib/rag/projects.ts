import fs from "node:fs";
import path from "node:path";
import { closeProjectDb, openProjectDb } from "@/lib/rag/db";
import {
  ensureProjectDirs,
  ensureProjectsRoot,
  getProjectDir,
  getProjectFilesDir,
  getRegistryPath,
} from "@/lib/rag/paths";
import type { Project, ProjectDocument } from "@/lib/rag/types";

function generateProjectId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `proj-${Date.now().toString(36)}-${rand}`;
}

function readRegistry(): Project[] {
  ensureProjectsRoot();
  const p = getRegistryPath();
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is Project =>
        !!x &&
        typeof x === "object" &&
        typeof (x as Project).id === "string" &&
        typeof (x as Project).name === "string",
    );
  } catch {
    return [];
  }
}

function writeRegistry(projects: Project[]): void {
  ensureProjectsRoot();
  fs.writeFileSync(
    getRegistryPath(),
    JSON.stringify(projects, null, 2),
    "utf8",
  );
}

export function listProjects(): Project[] {
  return readRegistry().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id: string): Project | null {
  return readRegistry().find((p) => p.id === id) ?? null;
}

export function createProject(name: string, description?: string): Project {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Project name is required.");
  }
  const now = Date.now();
  const project: Project = {
    id: generateProjectId(),
    name: trimmed,
    description: description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    documentCount: 0,
  };
  ensureProjectDirs(project.id);
  // Touch DB so schema exists immediately
  openProjectDb(project.id);
  const all = readRegistry();
  all.push(project);
  writeRegistry(all);
  return project;
}

export function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "description">>,
): Project {
  const all = readRegistry();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error(`Project not found: ${id}`);
  const current = all[idx];
  const next: Project = {
    ...current,
    name:
      typeof patch.name === "string" && patch.name.trim()
        ? patch.name.trim()
        : current.name,
    description:
      patch.description !== undefined
        ? patch.description?.trim() || undefined
        : current.description,
    updatedAt: Date.now(),
  };
  all[idx] = next;
  writeRegistry(all);
  return next;
}

export function deleteProject(id: string): void {
  if (!getProject(id)) {
    throw new Error(`Project not found: ${id}`);
  }
  closeProjectDb(id);
  const all = readRegistry().filter((p) => p.id !== id);
  writeRegistry(all);
  const dir = getProjectDir(id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function touchProjectMeta(
  id: string,
  opts: {
    embeddingModel?: string;
    embeddingDims?: number;
    documentCountDelta?: number;
    documentCountAbsolute?: number;
  },
): void {
  const all = readRegistry();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return;
  const current = all[idx];
  let documentCount = current.documentCount;
  if (typeof opts.documentCountAbsolute === "number") {
    documentCount = opts.documentCountAbsolute;
  } else if (typeof opts.documentCountDelta === "number") {
    documentCount = Math.max(0, documentCount + opts.documentCountDelta);
  }
  all[idx] = {
    ...current,
    documentCount,
    embeddingModel: opts.embeddingModel ?? current.embeddingModel,
    embeddingDims: opts.embeddingDims ?? current.embeddingDims,
    updatedAt: Date.now(),
  };
  writeRegistry(all);
}

export function listDocuments(projectId: string): ProjectDocument[] {
  if (!getProject(projectId)) {
    throw new Error(`Project not found: ${projectId}`);
  }
  const db = openProjectDb(projectId);
  const rows = db
    .prepare(
      `SELECT id, filename, mime_type, byte_size, chunk_count, status, error_message, created_at
       FROM documents
       ORDER BY created_at DESC`,
    )
    .all() as Array<{
    id: string;
    filename: string;
    mime_type: string;
    byte_size: number;
    chunk_count: number;
    status: "pending" | "ready" | "error";
    error_message: string | null;
    created_at: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    projectId,
    filename: r.filename,
    mimeType: r.mime_type,
    byteSize: r.byte_size,
    chunkCount: r.chunk_count,
    status: r.status,
    errorMessage: r.error_message ?? undefined,
    createdAt: r.created_at,
  }));
}

export function deleteDocument(projectId: string, docId: string): void {
  if (!getProject(projectId)) {
    throw new Error(`Project not found: ${projectId}`);
  }
  const db = openProjectDb(projectId);
  const row = db
    .prepare(`SELECT id, filename FROM documents WHERE id = ?`)
    .get(docId) as { id: string; filename: string } | undefined;
  if (!row) {
    throw new Error(`Document not found: ${docId}`);
  }

  // Remove FTS rows for this document's chunks
  const chunkIds = db
    .prepare(`SELECT id FROM chunks WHERE document_id = ?`)
    .all(docId) as Array<{ id: string }>;

  const tx = db.transaction(() => {
    for (const c of chunkIds) {
      db.prepare(`DELETE FROM chunks_fts WHERE chunk_id = ?`).run(c.id);
    }
    db.prepare(`DELETE FROM chunks WHERE document_id = ?`).run(docId);
    db.prepare(`DELETE FROM documents WHERE id = ?`).run(docId);
  });
  tx();

  // Best-effort raw file cleanup
  const filesDir = getProjectFilesDir(projectId);
  if (fs.existsSync(filesDir)) {
    for (const name of fs.readdirSync(filesDir)) {
      if (name.startsWith(`${docId}__`)) {
        try {
          fs.unlinkSync(path.join(filesDir, name));
        } catch {
          // ignore
        }
      }
    }
  }

  const remaining = (
    db.prepare(`SELECT COUNT(*) AS n FROM documents`).get() as { n: number }
  ).n;
  touchProjectMeta(projectId, { documentCountAbsolute: remaining });
}
