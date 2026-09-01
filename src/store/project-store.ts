"use client";

const ACTIVE_PROJECT_KEY = "cogito.activeProjectId.v1";

function isClient(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadActiveProjectId(): string | null {
  if (!isClient()) return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_PROJECT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveActiveProjectId(id: string | null): void {
  if (!isClient()) return;
  try {
    if (id === null) {
      window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
    } else {
      window.localStorage.setItem(ACTIVE_PROJECT_KEY, JSON.stringify(id));
    }
  } catch {
    // Ignore quota / privacy-mode failures.
  }
}
