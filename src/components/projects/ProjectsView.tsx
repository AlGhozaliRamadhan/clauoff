"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Project, ProjectDocument } from "@/lib/rag/types";

interface ProjectsViewProps {
  onBackToChat: () => void;
  onChatInProject: (project: Project) => void;
  onProjectsChanged?: (projects: Project[]) => void;
}

export function ProjectsView({
  onBackToChat,
  onChatInProject,
  onProjectsChanged,
}: ProjectsViewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  const refreshProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to load projects");
    }
    const data = await res.json();
    const list = (data.projects ?? []) as Project[];
    setProjects(list);
    onProjectsChanged?.(list);
    return list;
  }, [onProjectsChanged]);

  const refreshDocuments = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}/documents`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to load documents");
    }
    const data = await res.json();
    setDocuments((data.documents ?? []) as ProjectDocument[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const list = await refreshProjects();
        if (!cancelled && list.length > 0 && !selectedId) {
          setSelectedId(list[0].id);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setTimeout(() => setDocuments([]), 0);
      return;
    }
    refreshDocuments(selectedId).catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load documents"),
    );
  }, [selectedId, refreshDocuments]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Create failed");
      setName("");
      const list = await refreshProjects();
      if (data.project?.id) setSelectedId(data.project.id);
      else if (list[0]) setSelectedId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedId || busy) return;
    if (!confirm("Delete this project and all of its documents?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${selectedId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setSelectedId(null);
      const list = await refreshProjects();
      if (list[0]) setSelectedId(list[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!selectedId) {
      setError("Select or create a project first.");
      return;
    }
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of list) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/projects/${selectedId}/documents`, {
          method: "POST",
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Upload failed for ${file.name}`);
        }
      }
      await refreshDocuments(selectedId);
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!selectedId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${selectedId}/documents/${docId}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      await refreshDocuments(selectedId);
      await refreshProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      void handleUploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div
        className="mx-auto px-4 py-8"
        style={{ maxWidth: "var(--content-max-width)" }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-2xl)",
                color: "var(--text-primary)",
                fontWeight: 500,
              }}
            >
              Projects
            </h1>
            <p
              className="mt-1"
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
              }}
            >
              Document libraries for grounded answers. Chats in a project
              retrieve from its files.
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToChat}
            className="px-3 py-1.5 rounded-lg cursor-pointer"
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            Back to chat
          </button>
        </div>

        {error && (
          <div
            className="mb-4 px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--border-subtle)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-ui)",
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Create */}
        <div className="flex gap-2 mb-6">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            placeholder="New project name"
            className="flex-1 px-3 py-2 rounded-lg outline-none"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-ui)",
              fontSize: "var(--text-sm)",
            }}
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-lg cursor-pointer disabled:opacity-50"
            style={{
              background: "var(--text-primary)",
              color: "var(--surface-sidebar)",
              fontFamily: "var(--font-ui)",
              fontSize: "var(--text-sm)",
            }}
          >
            Create
          </button>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-secondary)" }}>Loading…</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            {/* Project list */}
            <div className="space-y-1">
              {projects.length === 0 && (
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-ui)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  No projects yet. Create one to upload documents.
                </p>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className="w-full text-left px-3 py-2 rounded-lg cursor-pointer"
                  style={{
                    background:
                      p.id === selectedId
                        ? "var(--bg-sidebar-active)"
                        : "transparent",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-ui)",
                    fontSize: "var(--text-sm)",
                  }}
                >
                  <div className="truncate font-medium">{p.name}</div>
                  <div
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "11px",
                    }}
                  >
                    {p.documentCount} file
                    {p.documentCount === 1 ? "" : "s"}
                  </div>
                </button>
              ))}
            </div>

            {/* Detail */}
            <div>
              {!selected ? (
                <p style={{ color: "var(--text-secondary)" }}>
                  Select a project.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <h2
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: "var(--text-lg)",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                      }}
                    >
                      {selected.name}
                    </h2>
                    <button
                      type="button"
                      onClick={() => onChatInProject(selected)}
                      className="px-3 py-1.5 rounded-lg cursor-pointer"
                      style={{
                        background: "var(--text-primary)",
                        color: "var(--surface-sidebar)",
                        fontFamily: "var(--font-ui)",
                        fontSize: "var(--text-xs)",
                      }}
                    >
                      Chat in project
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteProject()}
                      className="px-3 py-1.5 rounded-lg cursor-pointer"
                      style={{
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-ui)",
                        fontSize: "var(--text-xs)",
                      }}
                    >
                      Delete project
                    </button>
                  </div>

                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDrop}
                    className="mb-4 px-4 py-8 rounded-xl text-center cursor-pointer"
                    style={{
                      border: "1px dashed var(--border-subtle)",
                      color: "var(--text-secondary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: "var(--text-sm)",
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading
                      ? "Uploading & indexing…"
                      : "Drop files here or click to upload (md, txt, pdf, code · max 10 MB)"}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept=".md,.txt,.pdf,.ts,.tsx,.js,.jsx,.py,.json,.css,.html,.rs,.go,.java,.c,.cpp,.h,.yml,.yaml,.toml,.sh"
                      onChange={(e) => {
                        if (e.target.files)
                          void handleUploadFiles(e.target.files);
                      }}
                    />
                  </div>

                  {/* Documents table */}
                  <div className="space-y-2">
                    {documents.length === 0 && (
                      <p
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        No documents yet.
                      </p>
                    )}
                    {documents.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                        style={{
                          border: "1px solid var(--border-subtle)",
                          fontFamily: "var(--font-ui)",
                          fontSize: "var(--text-sm)",
                        }}
                      >
                        <div className="min-w-0">
                          <div
                            className="truncate"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {d.filename}
                          </div>
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              fontSize: "11px",
                            }}
                          >
                            {d.status}
                            {d.status === "ready"
                              ? ` · ${d.chunkCount} chunks`
                              : ""}
                            {d.errorMessage ? ` · ${d.errorMessage}` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteDoc(d.id)}
                          className="px-2 py-1 rounded cursor-pointer flex-shrink-0"
                          style={{
                            color: "var(--text-secondary)",
                            fontSize: "12px",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
