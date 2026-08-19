"use client";

import type { Message } from "@/components/ChatThread";

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  /** When set, /api/chat retrieves from this project library (ADR-0005). */
  projectId?: string | null;
}

const STORAGE_KEY = "cogito.conversations.v1";
const ACTIVE_KEY = "cogito.activeConversationId.v1";

function isClient(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const baseOk =
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    Array.isArray(v.messages) &&
    typeof v.createdAt === "number" &&
    typeof v.updatedAt === "number";
  if (!baseOk) return false;
  // projectId is optional; accept string, null, or missing
  if (
    "projectId" in v &&
    v.projectId !== undefined &&
    v.projectId !== null &&
    typeof v.projectId !== "string"
  ) {
    return false;
  }
  return true;
}

export function loadConversations(): Conversation[] {
  if (!isClient()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isConversation);
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (!isClient()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Ignore quota / privacy-mode failures — chat still works in-memory.
  }
}

export function loadActiveConversationId(): string | null {
  if (!isClient()) return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveActiveConversationId(id: string | null): void {
  if (!isClient()) return;
  try {
    if (id === null) {
      window.localStorage.removeItem(ACTIVE_KEY);
    } else {
      window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(id));
    }
  } catch {
    // Same swallow as above.
  }
}

export function generateConversationId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback if randomUUID is not available in some older environments
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
  );
}

export function generateMessageId(role: "user" | "assistant"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `msg-${Date.now().toString(36)}-${role}-${rand}`;
}
