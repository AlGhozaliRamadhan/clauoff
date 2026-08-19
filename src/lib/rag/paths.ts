import fs from "node:fs";
import path from "node:path";

export function getDataRoot(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

export function getProjectsRoot(): string {
  return path.join(getDataRoot(), "projects");
}

export function getRegistryPath(): string {
  return path.join(getProjectsRoot(), "registry.json");
}

export function getProjectDir(projectId: string): string {
  return path.join(getProjectsRoot(), projectId);
}

export function getProjectDbPath(projectId: string): string {
  return path.join(getProjectDir(projectId), "index.db");
}

export function getProjectFilesDir(projectId: string): string {
  return path.join(getProjectDir(projectId), "files");
}

export function ensureProjectsRoot(): void {
  fs.mkdirSync(getProjectsRoot(), { recursive: true });
}

export function ensureProjectDirs(projectId: string): void {
  fs.mkdirSync(getProjectFilesDir(projectId), { recursive: true });
}

/** Sanitize a filename for safe storage on disk. */
export function safeFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^\w.\- ()[\]]+/g, "_");
  return base.length > 0 ? base.slice(0, 180) : "file";
}
