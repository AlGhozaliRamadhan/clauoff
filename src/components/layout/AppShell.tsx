"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ChatThread, type Message } from "@/components/chat/ChatThread";
import { Composer } from "@/components/chat/Composer";
import { EmptyState } from "@/components/chat/EmptyState";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { ProjectsView } from "@/components/projects/ProjectsView";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { useArtifact } from "@/contexts/ArtifactContext";
import { useAudio } from "@/contexts/AudioContext";
import { ArtifactViewer } from "@/components/artifacts/ArtifactViewer";
import {
  type Conversation,
  generateConversationId,
  generateMessageId,
  loadActiveConversationId,
  loadConversations,
  saveActiveConversationId,
  saveConversations,
} from "@/store/conversation-store";
import {
  loadActiveProjectId,
  saveActiveProjectId,
} from "@/store/project-store";
import {
  ensureTreeState,
  getLinearMessages,
  appendNewTurn,
  forkAndEditUserMessage,
  forkAndRetryAssistantMessage,
  switchBranch,
  type MessageNode,
} from "@/lib/utils/tree-utils";
import type { Project, SourceCitation } from "@/lib/rag/types";
import { generateSmartFallbackTitle } from "@/lib/utils/title-utils";
import { useVoiceSession } from "@/hooks/useVoiceSession";

type MainView = "chat" | "projects";

/**
 * AppShell — the main layout container.
 * Combines sidebar (left) + main content pane (right: topbar + chat/empty/projects + composer).
 */
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string>("general");
  const [mainView, setMainView] = useState<MainView>("chat");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [attachStatus, setAttachStatus] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [streamingConversationIds, setStreamingConversationIds] = useState<string[]>([]);
  const abortControllersRef = useRef<{ [convId: string]: AbortController }>({});

  const {
    isPlaying,
    isGenerating,
    playVoice,
    enqueueVoiceChunk,
    stopVoice,
    voiceSettings,
    updateVoiceSettings,
  } = useAudio();
  // Persistence is debounced so streaming bursts (one setState per token)
  // don't synchronously serialize the whole conversation history to
  // localStorage on every token. The latest state + a final flush on tab
  // teardown guarantee nothing is lost. (P2 perf finding)
  const saveTimerRef = useRef<number | null>(null);
  const pendingConversationsRef = useRef<Conversation[]>([]);
  // Web-search tool offering (ADR-0006). Persisted; default OFF — the small
  // local models this app typically talks to cannot emit reliable tool calls,
  // so offering tools just produces narration instead of answers. The toggle
  // in the composer flips it per session.
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("cogito.webSearch.v1") === "true") {
      setWebSearchEnabled(true);
    }
  }, []);

  const handleWebSearchToggle = useCallback((enabled: boolean) => {
    setWebSearchEnabled(enabled);
    localStorage.setItem("cogito.webSearch.v1", String(enabled));
  }, []);

  const { activeArtifact, setActiveArtifact } = useArtifact();
  const {
    user,
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    syncConversationsToDb,
    loadConversationsFromDb,
  } = useAuth();

  // Load from local database when user logs in
  useEffect(() => {
    if (user && isHydrated) {
      loadConversationsFromDb().then((dbConvs) => {
        if (dbConvs && dbConvs.length > 0) {
          setConversations((prev) => {
            const map = new Map<string, Conversation>();
            for (const c of prev) map.set(c.id, c);
            for (const c of dbConvs) map.set(c.id, c);
            return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
          });
        }
      });
    }
  }, [user, isHydrated, loadConversationsFromDb]);

  // Sync to local database whenever conversations update
  useEffect(() => {
    if (user && isHydrated && conversations.length > 0) {
      const timer = setTimeout(() => {
        syncConversationsToDb(conversations);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [conversations, user, isHydrated, syncConversationsToDb]);

  // Hydrate from localStorage on client mount
  useEffect(() => {
    const rawLoaded = loadConversations();
    const loadedConversations = rawLoaded.map((c) => {
      const tree = ensureTreeState(c.messages, c.mapping, c.currentLeafId);
      const linear = getLinearMessages(tree.mapping, tree.currentLeafId);
      return {
        ...c,
        mapping: tree.mapping,
        currentLeafId: tree.currentLeafId,
        messages: linear.length > 0 ? linear : c.messages,
      };
    });
    setConversations(loadedConversations);

    const pathParts = window.location.pathname.split("/");
    const chatParam = pathParts[1] === "c" && pathParts[2] ? decodeURIComponent(pathParts[2]) : null;
    const storedActive = loadActiveConversationId();
    
    // Prioritize URL param over localStorage if it's a valid conversation
    const initialActive = chatParam && loadedConversations.some((c) => c.id === chatParam) 
      ? chatParam 
      : (storedActive && loadedConversations.some((c) => c.id === storedActive) ? storedActive : null);
      
    if (initialActive) {
      setActiveConversationId(initialActive);
    }

    const storedProject = loadActiveProjectId();
    if (storedProject) setActiveProjectId(storedProject);

    setIsHydrated(true);
  }, []);

  // Load projects list for name resolution / composer indicator
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/projects");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setProjects((data.projects ?? []) as Project[]);
      } catch {
        // Projects API may be unavailable until deps install; chat still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [newBuildAvailable, setNewBuildAvailable] = useState(false);
  const currentBuildIdRef = useRef<string | null>(null);

  // Check for new builds / server restarts to alert user
  useEffect(() => {
    let cancelled = false;

    async function checkVersion() {
      try {
        const res = await fetch("/api/version");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (currentBuildIdRef.current === null) {
          currentBuildIdRef.current = data.buildId;
        } else if (currentBuildIdRef.current !== data.buildId) {
          setNewBuildAvailable(true);
        }
      } catch {
        // ignore network error
      }
    }

    checkVersion();
    const interval = setInterval(checkVersion, 25000);
    window.addEventListener("focus", checkVersion);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", checkVersion);
    };
  }, []);

  const isActiveStreaming = activeConversationId
    ? streamingConversationIds.includes(activeConversationId)
    : false;

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const messages = activeConversation?.messages ?? [];

  // Effective project for the current chat: conversation binding wins, else UI active project for new chats
  const effectiveProjectId =
    activeConversation?.projectId ??
    (activeConversationId ? null : activeProjectId);

  const activeProjectName =
    projects.find((p) => p.id === effectiveProjectId)?.name ??
    projects.find((p) => p.id === activeProjectId)?.name ??
    null;

  const handleNewChat = useCallback(() => {
    setMainView("chat");
    setActiveConversationId(null);
    setInputValue("");
  }, []);

  const handleSelectConversation = useCallback((id: string) => {
    setMainView("chat");
    setActiveConversationId(id);
    setInputValue("");
    const conv = conversations.find((c) => c.id === id);
    if (conv?.projectId) {
      setActiveProjectId(conv.projectId);
    }
  }, [conversations]);

  const handleOpenProjects = useCallback(() => {
    setMainView("projects");
  }, []);

  const handleChatInProject = useCallback((project: Project) => {
    setActiveProjectId(project.id);
    setMainView("chat");
    setActiveConversationId(null);
    setInputValue("");
  }, []);

  function generateTitle(content: string): string {
    return generateSmartFallbackTitle(content);
  }

  const handleRenameConversation = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed, updatedAt: Date.now() } : c))
    );
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
  }, [activeConversationId]);

  const handleAttachFiles = useCallback(
    async (files: FileList) => {
      const projectId = effectiveProjectId || activeProjectId;
      if (!projectId) {
        setAttachStatus("Open or select a project before uploading files.");
        return;
      }
      setAttachStatus("Uploading…");
      try {
        for (const file of Array.from(files)) {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch(`/api/projects/${projectId}/documents`, {
            method: "POST",
            body: form,
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || `Upload failed for ${file.name}`);
          }
        }
        setAttachStatus("Indexed in project library.");
        // Refresh project counts
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects((data.projects ?? []) as Project[]);
        }
        setTimeout(() => setAttachStatus(null), 2500);
      } catch (e) {
        setAttachStatus(
          e instanceof Error ? e.message : "Upload failed",
        );
      }
    },
    [effectiveProjectId, activeProjectId],
  );

  const executeStream = useCallback(
    async ({
      convId,
      assistantMsgId,
      apiMessages,
      projectId,
    }: {
      convId: string;
      assistantMsgId: string;
      apiMessages: Array<{ role: "user" | "assistant"; content: string }>;
      projectId?: string | null;
    }) => {
      setStreamingConversationIds((prev) => [...prev, convId]);

      const controller = new AbortController();
      abortControllersRef.current[convId] = controller;

      const effort = localStorage.getItem("cogito.effort.v2") || "Medium";
      const thinking = localStorage.getItem("cogito.thinking.v2") !== "false";

      try {
        let response: Response;
        let retries = 0;
        const MAX_RETRIES = 2;

        while (true) {
          try {
            response = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                model: selectedModel || undefined,
                messages: apiMessages,
                projectId: projectId || undefined,
                effort,
                thinking,
                webSearch: webSearchEnabled,
              }),
              signal: controller.signal,
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(
                errorData.error || `Backend error (${response.status})`,
              );
            }
            break;
          } catch (err) {
            if ((err as Error).name === "AbortError" || retries >= MAX_RETRIES) {
              throw err;
            }
            retries++;
            await new Promise((r) => setTimeout(r, 2000));
          }
        }

        // Parse citation sources from response header
        let sources: SourceCitation[] | undefined;
        const sourcesHeader = response.headers.get("Cogito-Sources");
        if (sourcesHeader) {
          try {
            sources = JSON.parse(decodeURIComponent(sourcesHeader)) as SourceCitation[];
          } catch {
            sources = undefined;
          }
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let accumulated = "";
        let lastSpokenIndex = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          accumulated += decoder.decode(value, { stream: true });

          // Real-time phrase & sentence voice playback while streaming
          if (voiceSettings.autoPlay) {
            // Strip thoughts, artifacts, and code blocks for spoken speech extraction
            const visibleSpokenText = accumulated
              .replace(/<\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>[\s\S]*?<\/\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>/gi, "")
              .replace(/<\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>[\s\S]*$/gi, "")
              .replace(/<artifact[\s\S]*?<\/artifact>/gi, " ")
              .replace(/<artifact[\s\S]*$/gi, " ")
              .replace(/```[\s\S]*?```/gi, " ")
              .replace(/```[\s\S]*$/gi, " ");

            const unprocessed = visibleSpokenText.slice(lastSpokenIndex);
            // 1. Punctuation match (. ? ! \n , ; : —)
            const sentenceMatch = unprocessed.match(/(?:[.!?\n]+(?:\s+|$))|(?:[,;:—–…]\s+)/);
            if (sentenceMatch && sentenceMatch.index !== undefined) {
              const sentenceEnd = sentenceMatch.index + sentenceMatch[0].length;
              const sentence = unprocessed.slice(0, sentenceEnd).trim();
              if (sentence.length > 0) {
                enqueueVoiceChunk(sentence, assistantMsgId);
              }
              lastSpokenIndex += sentenceEnd;
            } else if (unprocessed.length >= 35) {
              // 2. Word count / length threshold fallback
              const lastSpace = unprocessed.lastIndexOf(" ");
              if (lastSpace > 15) {
                const chunk = unprocessed.slice(0, lastSpace).trim();
                if (chunk.length > 0) {
                  enqueueVoiceChunk(chunk, assistantMsgId);
                }
                lastSpokenIndex += lastSpace + 1;
              }
            }
          }

          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== convId) return c;
              const newMapping = c.mapping ? { ...c.mapping } : {};
              if (newMapping[assistantMsgId]) {
                newMapping[assistantMsgId] = {
                  ...newMapping[assistantMsgId],
                  content: accumulated,
                  isStreaming: true,
                  sources: sources ?? newMapping[assistantMsgId].sources,
                };
              }
              const linear = c.currentLeafId
                ? getLinearMessages(newMapping, c.currentLeafId)
                : c.messages.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: accumulated, isStreaming: true, sources: sources ?? m.sources }
                      : m,
                  );
              return {
                ...c,
                updatedAt: Date.now(),
                mapping: newMapping,
                messages: linear,
              };
            }),
          );
        }

        // Mark completion
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== convId) return c;
            const newMapping = c.mapping ? { ...c.mapping } : {};
            if (newMapping[assistantMsgId]) {
              newMapping[assistantMsgId] = {
                ...newMapping[assistantMsgId],
                content: accumulated,
                isStreaming: false,
                sources: sources ?? newMapping[assistantMsgId].sources,
              };
            }
            const linear = c.currentLeafId
              ? getLinearMessages(newMapping, c.currentLeafId)
              : c.messages.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: accumulated, isStreaming: false, sources: sources ?? m.sources }
                    : m,
                );
            return {
              ...c,
              updatedAt: Date.now(),
              mapping: newMapping,
              messages: linear,
            };
          }),
        );

        // Asynchronously trigger AI title generation on first turn completion
        if (apiMessages.length <= 2 && accumulated.trim().length > 0) {
          const titlePayload = [
            ...apiMessages,
            { role: "assistant" as const, content: accumulated },
          ];
          fetch("/api/chat/title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: titlePayload,
              model: selectedModel || undefined,
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data?.title && data.title !== "New Chat") {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId ? { ...c, title: data.title, updatedAt: Date.now() } : c
                  )
                );
              }
            })
            .catch(() => {});
        }

        // Enqueue any remaining tail text after generation finishes
        if (voiceSettings.autoPlay) {
          const visibleSpokenText = accumulated
            .replace(/<\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>[\s\S]*?<\/\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>/gi, "")
            .replace(/<\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>[\s\S]*$/gi, "")
            .replace(/<artifact[\s\S]*?<\/artifact>/gi, " ")
            .replace(/<artifact[\s\S]*$/gi, " ")
            .replace(/```[\s\S]*?```/gi, " ")
            .replace(/```[\s\S]*$/gi, " ");

          const remaining = visibleSpokenText.slice(lastSpokenIndex).trim();
          if (remaining.length > 0) {
            enqueueVoiceChunk(remaining, assistantMsgId);
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          stopVoice();
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== convId) return c;
              const newMapping = c.mapping ? { ...c.mapping } : {};
              if (newMapping[assistantMsgId]) {
                newMapping[assistantMsgId] = {
                  ...newMapping[assistantMsgId],
                  isStreaming: false,
                };
              }
              const linear = c.currentLeafId
                ? getLinearMessages(newMapping, c.currentLeafId)
                : c.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, isStreaming: false } : m,
                  );
              return {
                ...c,
                updatedAt: Date.now(),
                mapping: newMapping,
                messages: linear,
              };
            }),
          );
        } else {
          stopVoice();
          const errorText = `⚠ ${(err as Error).message || "An error occurred. Is your backend running?"}`;
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== convId) return c;
              const newMapping = c.mapping ? { ...c.mapping } : {};
              if (newMapping[assistantMsgId]) {
                newMapping[assistantMsgId] = {
                  ...newMapping[assistantMsgId],
                  content: errorText,
                  isStreaming: false,
                };
              }
              const linear = c.currentLeafId
                ? getLinearMessages(newMapping, c.currentLeafId)
                : c.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: errorText, isStreaming: false } : m,
                  );
              return {
                ...c,
                updatedAt: Date.now(),
                mapping: newMapping,
                messages: linear,
              };
            }),
          );
        }
      } finally {
        delete abortControllersRef.current[convId];
        setStreamingConversationIds((prev) => prev.filter((id) => id !== convId));
      }
    },
    [selectedModel, webSearchEnabled, voiceSettings.autoPlay, enqueueVoiceChunk, playVoice, stopVoice],
  );

  const sendMessageText = useCallback((rawText: string): boolean => {
    const text = rawText.trim();
    if (!text || isActiveStreaming) return false;

    let convId = activeConversationId;
    let currentMapping: Record<string, MessageNode> = {};
    let currentLeafId: string | null = null;
    const now = Date.now();
    const projectIdForConv = activeConversation?.projectId ?? activeProjectId ?? null;

    if (!convId) {
      convId = generateConversationId();
      const tree = ensureTreeState([], {}, null);
      currentMapping = tree.mapping;
      currentLeafId = tree.currentLeafId;
    } else {
      const conv = conversations.find((c) => c.id === convId);
      const tree = ensureTreeState(conv?.messages, conv?.mapping, conv?.currentLeafId);
      currentMapping = tree.mapping;
      currentLeafId = tree.currentLeafId;
    }

    const { mapping: newMapping, assistantNode, newLeafId } = appendNewTurn(
      currentMapping,
      currentLeafId,
      text,
    );

    const linearMessages = getLinearMessages(newMapping, newLeafId);

    if (!activeConversationId) {
      const newConv: Conversation = {
        id: convId,
        title: generateTitle(text),
        messages: linearMessages,
        mapping: newMapping,
        currentLeafId: newLeafId,
        createdAt: now,
        updatedAt: now,
        projectId: projectIdForConv,
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(convId);
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: linearMessages,
                mapping: newMapping,
                currentLeafId: newLeafId,
                updatedAt: now,
              }
            : c,
        ),
      );
    }

    setMainView("chat");
    setInputValue("");

    const apiMessages = linearMessages
      .filter((m) => m.id !== assistantNode.id && m.content.length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    void executeStream({
      convId,
      assistantMsgId: assistantNode.id,
      apiMessages,
      projectId: projectIdForConv,
    });
    return true;
  }, [
    isActiveStreaming,
    activeConversationId,
    activeConversation,
    activeProjectId,
    conversations,
    executeStream,
  ]);

  const handleSend = useCallback(() => {
    sendMessageText(inputValue);
  }, [inputValue, sendMessageText]);

  const handleEditMessage = useCallback(
    async (userNodeId: string, newContent: string) => {
      if (!activeConversationId || isActiveStreaming) return;
      const convId = activeConversationId;
      const conv = conversations.find((c) => c.id === convId);
      if (!conv) return;

      const tree = ensureTreeState(conv.messages, conv.mapping, conv.currentLeafId);
      if (!tree.mapping[userNodeId]) return;

      const { mapping: newMapping, assistantNode, newLeafId } = forkAndEditUserMessage(
        tree.mapping,
        userNodeId,
        newContent,
      );

      const linearMessages = getLinearMessages(newMapping, newLeafId);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: linearMessages,
                mapping: newMapping,
                currentLeafId: newLeafId,
                updatedAt: Date.now(),
              }
            : c,
        ),
      );

      const apiMessages = linearMessages
        .filter((m) => m.id !== assistantNode.id && m.content.length > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      executeStream({
        convId,
        assistantMsgId: assistantNode.id,
        apiMessages,
        projectId: conv.projectId,
      });
    },
    [activeConversationId, isActiveStreaming, conversations, executeStream],
  );

  const handleRetryTurn = useCallback(
    async (assistantNodeId?: string) => {
      if (!activeConversationId || isActiveStreaming) return;
      const convId = activeConversationId;
      const conv = conversations.find((c) => c.id === convId);
      if (!conv || conv.messages.length === 0) return;

      const tree = ensureTreeState(conv.messages, conv.mapping, conv.currentLeafId);

      // Default to last assistant message in current linear path if none passed
      let targetId = assistantNodeId;
      if (!targetId) {
        for (let i = conv.messages.length - 1; i >= 0; i--) {
          if (conv.messages[i].role === "assistant") {
            targetId = conv.messages[i].id;
            break;
          }
        }
      }

      if (!targetId || !tree.mapping[targetId] || tree.mapping[targetId].role !== "assistant") {
        return;
      }

      const { mapping: newMapping, assistantNode, newLeafId } = forkAndRetryAssistantMessage(
        tree.mapping,
        targetId,
      );

      const linearMessages = getLinearMessages(newMapping, newLeafId);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: linearMessages,
                mapping: newMapping,
                currentLeafId: newLeafId,
                updatedAt: Date.now(),
              }
            : c,
        ),
      );

      const apiMessages = linearMessages
        .filter((m) => m.id !== assistantNode.id && m.content.length > 0)
        .map((m) => ({ role: m.role, content: m.content }));

      executeStream({
        convId,
        assistantMsgId: assistantNode.id,
        apiMessages,
        projectId: conv.projectId,
      });
    },
    [activeConversationId, isActiveStreaming, conversations, executeStream],
  );

  const handleSwitchVersion = useCallback(
    (targetNodeId: string) => {
      if (!activeConversationId) return;
      const convId = activeConversationId;
      const conv = conversations.find((c) => c.id === convId);
      if (!conv) return;

      const tree = ensureTreeState(conv.messages, conv.mapping, conv.currentLeafId);
      const newLeafId = switchBranch(tree.mapping, targetNodeId);
      const linearMessages = getLinearMessages(tree.mapping, newLeafId);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                messages: linearMessages,
                mapping: tree.mapping,
                currentLeafId: newLeafId,
                updatedAt: Date.now(),
              }
            : c,
        ),
      );
    },
    [activeConversationId, conversations],
  );

  const handleStop = useCallback(() => {
    if (activeConversationId) {
      abortControllersRef.current[activeConversationId]?.abort();
    }
  }, [activeConversationId]);

  const handleVoiceInterrupt = useCallback(() => {
    stopVoice();
    if (activeConversationId) {
      abortControllersRef.current[activeConversationId]?.abort();
    } else {
      Object.values(abortControllersRef.current).forEach((controller) => controller.abort());
    }
  }, [activeConversationId, stopVoice]);

  const voiceController = useVoiceSession({
    isAssistantStreaming: isActiveStreaming,
    isAssistantSpeaking: isPlaying || isGenerating,
    onInterrupt: handleVoiceInterrupt,
    onTranscript: sendMessageText,
  });

  const toggleVoiceConversation = useCallback(async () => {
    if (!voiceController.enabled) {
      updateVoiceSettings({ autoPlay: true });
      if (voiceSettings.engine === "neural") {
        void fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "warmup", voice: voiceSettings.voiceId }),
        }).catch(() => {});
      }
    }
    await voiceController.toggle();
  }, [updateVoiceSettings, voiceController, voiceSettings.engine, voiceSettings.voiceId]);

  const voiceSession = {
    ...voiceController,
    toggle: toggleVoiceConversation,
  };

  const handleSuggestionClick = useCallback((label: string) => {
    const prompts: Record<string, string> = {
      Write: "Help me write ",
      Learn: "Explain the concept of ",
      Code: "Write a function that ",
      "Life stuff": "Give me advice on ",
      "Surprise me": "Tell me something interesting and unexpected",
    };
    setInputValue(prompts[label] ?? label);
  }, []);

  React.useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleNewChat();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleNewChat]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedFont = localStorage.getItem("cogito.font.v1");
      const root = document.documentElement;
      if (storedFont === "System Sans-Serif") {
        root.style.setProperty("--font-body", "var(--font-ui)");
      } else if (storedFont === "Mono") {
        root.style.setProperty("--font-body", "var(--font-mono)");
      } else if (storedFont) {
        root.style.setProperty("--font-body", "var(--font-display)");
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      Object.values(abortControllersRef.current).forEach((ctrl) => ctrl.abort());
    };
  }, []);

  const sidebarConversations = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    isActive: c.id === activeConversationId,
  }));

  // Debounced persistence — flush at most once every 300ms during streaming.
  useEffect(() => {
    if (!isHydrated) return;
    pendingConversationsRef.current = conversations;
    if (saveTimerRef.current !== null) return; // a flush is already scheduled
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      if (pendingConversationsRef.current) {
        saveConversations(pendingConversationsRef.current);
      }
    }, 300);
  }, [conversations, isHydrated]);

  useEffect(() => {
    // Final flush on unmount / tab close so the debounce never loses the tail.
    const flush = () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (pendingConversationsRef.current) {
        try {
          saveConversations(pendingConversationsRef.current);
        } catch {
          // localStorage may be unavailable during teardown — ignore.
        }
      }
    };
    window.addEventListener("beforeunload", flush);
    const suppress = (e: BeforeUnloadEvent) => {
      // Run the flush synchronously BEFORE the page unloads. The callback's
      // payloads are best-effort; localStorage survives across the navigation.
      flush();
      // Don't show a browser prompt — the flush is synchronous.
      delete e.returnValue;
    };
    window.addEventListener("pagehide", suppress);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", suppress);
      flush();
    };
  }, []);

  useEffect(() => {
    if (isHydrated) {
      saveActiveConversationId(activeConversationId);
      // Sync URL with current chat using clean paths
      if (activeConversationId) {
        window.history.replaceState(null, "", `/c/${activeConversationId}`);
      } else {
        window.history.replaceState(null, "", "/");
      }
    }
    // Always close active sandbox when switching conversations or starting a new chat
    setActiveArtifact(null);
  }, [activeConversationId, isHydrated, setActiveArtifact]);

  useEffect(() => {
    if (isHydrated) {
      saveActiveProjectId(activeProjectId);
    }
  }, [activeProjectId, isHydrated]);

  const composerShared = {
    value: inputValue,
    onChange: setInputValue,
    onSend: handleSend,
    onStop: handleStop,
    isStreaming: isActiveStreaming,
    selectedModel,
    onModelChange: setSelectedModel,
    projectName: activeProjectName,
    onAttachFiles:
      effectiveProjectId || activeProjectId
        ? handleAttachFiles
        : undefined,
    webSearchEnabled,
    onWebSearchToggle: handleWebSearchToggle,
    onOpenSettings: () => {
      setSettingsTab("general");
      setShowSettings(true);
    },
    voiceSession,
  };

  const handleOpenSettings = useCallback((tab: string = "general") => {
    setSettingsTab(tab);
    setShowSettings(true);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-app)" }}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={handleNewChat}
        conversations={sidebarConversations}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenSettings={handleOpenSettings}
        onOpenProjects={handleOpenProjects}
        onOpenChats={() => setMainView("chat")}
        hasUpdate={newBuildAvailable}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopBar
          isSidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(true)}
        />
        
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden w-full">
          {/* Main Chat/Project Column */}
          <div className={`flex flex-col min-w-0 h-full flex-1 transition-all duration-300 ease-in-out ${activeArtifact ? "w-1/2 border-r border-[var(--border-subtle)]" : "w-full"}`}>
            {mainView === "projects" ? (
          <ProjectsView
            onBackToChat={() => setMainView("chat")}
            onChatInProject={handleChatInProject}
            onProjectsChanged={setProjects}
          />
        ) : messages.length === 0 && !activeConversationId ? (
          <EmptyState
            onSuggestionClick={handleSuggestionClick}
            composer={
              <Composer {...composerShared} isCompact={false} />
            }
          />
        ) : (
          <>
            <ChatThread
              messages={messages}
              treeMapping={activeConversation?.mapping}
              onEditMessage={handleEditMessage}
              onRetry={handleRetryTurn}
              onSwitchVersion={handleSwitchVersion}
              isGenerating={isActiveStreaming}
            />

            <div
              className="flex-shrink-0 px-4 pb-4 pt-2 w-full"
              style={{ maxWidth: "var(--content-max-width)", margin: "0 auto" }}
            >
              {attachStatus && (
                <div
                  className="text-center mb-2 text-xs"
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-ui)",
                  }}
                >
                  {attachStatus}
                </div>
              )}
              <Composer {...composerShared} isCompact={true} />
              <div
                className="text-center mt-2 text-xs-ui"
                style={{ color: "var(--text-secondary)" }}
              >
                Cogito uses your own API models. Responses may vary.
              </div>
            </div>
          </>
        )}
          </div>
          
          {/* Artifact Column */}
          {activeArtifact && (
            <div className="flex-1 flex flex-col min-w-0 h-full w-1/2 bg-[var(--surface-raised)]">
              <ArtifactViewer />
            </div>
          )}
        </div>
      </div>
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        initialTab={settingsTab}
      />
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} initialMode={authModalMode} />
    </div>
  );
}
