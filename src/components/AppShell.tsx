"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";
import { EmptyState } from "./EmptyState";
import { SettingsModal } from "./SettingsModal";
import { ProjectsView } from "./ProjectsView";
import { useArtifact } from "@/contexts/ArtifactContext";
import { ArtifactViewer } from "./ArtifactViewer";
import {
  type Conversation,
  generateConversationId,
  generateMessageId,
  loadActiveConversationId,
  loadConversations,
  saveActiveConversationId,
  saveConversations,
} from "@/lib/conversation-store";
import {
  loadActiveProjectId,
  saveActiveProjectId,
} from "@/lib/project-store";
import type { Message } from "./ChatThread";
import type { Project, SourceCitation } from "@/lib/rag/types";

type MainView = "chat" | "projects";

/**
 * AppShell — the main layout container.
 * Combines sidebar (left) + main content pane (right: topbar + chat/empty/projects + composer).
 */
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
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

  const { activeArtifact } = useArtifact();

  // Hydrate from localStorage on client mount
  useEffect(() => {
    const loadedConversations = loadConversations();
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
    const trimmed = content.trim();
    if (trimmed.length <= 40) return trimmed;
    return trimmed.slice(0, 40) + "…";
  }

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

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isActiveStreaming) return;

    const userMsg: Message = {
      id: generateMessageId("user"),
      role: "user",
      content: text,
    };

    const assistantMsg: Message = {
      id: generateMessageId("assistant"),
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    let convId = activeConversationId;
    let updatedConversations: Conversation[];
    const projectIdForConv =
      activeConversation?.projectId ?? activeProjectId ?? null;

    if (!convId) {
      convId = generateConversationId();
      const now = Date.now();
      const newConv: Conversation = {
        id: convId,
        title: generateTitle(text),
        messages: [userMsg, assistantMsg],
        createdAt: now,
        updatedAt: now,
        projectId: projectIdForConv,
      };
      updatedConversations = [newConv, ...conversations];
    } else {
      updatedConversations = conversations.map((c) =>
        c.id === convId
          ? {
              ...c,
              messages: [...c.messages, userMsg, assistantMsg],
              updatedAt: Date.now(),
            }
          : c,
      );
    }

    setConversations(updatedConversations);
    setActiveConversationId(convId);
    setMainView("chat");
    setInputValue("");
    setStreamingConversationIds((prev) => [...prev, convId]);

    const currentConv = updatedConversations.find((c) => c.id === convId);
    const apiMessages = (currentConv?.messages ?? [])
      .filter((m) => m.content.length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    abortControllersRef.current[convId] = controller;

    const effort = localStorage.getItem("cogito.effort.v2") || "Medium";
    // Default to ON when unset — matches the ModelSelector UI default. A
    // mismatch here silently disables the thinking prompt for fresh users.
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
              projectId: currentConv?.projectId || undefined,
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
          
          break; // Success, exit retry loop
        } catch (err) {
          if ((err as Error).name === "AbortError" || retries >= MAX_RETRIES) {
            throw err;
          }
          retries++;
          // Wait 2 seconds before retrying
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      // Parse citation sources from response header (ADR-0005)
      let sources: SourceCitation[] | undefined;
      const sourcesHeader = response.headers.get("Cogito-Sources");
      if (sourcesHeader) {
        try {
          sources = JSON.parse(
            decodeURIComponent(sourcesHeader),
          ) as SourceCitation[];
        } catch {
          sources = undefined;
        }
      }

      // Attach sources as soon as headers arrive (chips wait until !isStreaming)
      if (sources && sources.length > 0) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsg.id ? { ...m, sources } : m,
                  ),
                }
              : c,
          ),
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          content: accumulated,
                          isStreaming: true,
                          sources: sources ?? m.sources,
                        }
                      : m,
                  ),
                }
              : c,
          ),
        );
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                updatedAt: Date.now(),
                messages: c.messages.map((m) =>
                  m.id === assistantMsg.id
                    ? {
                        ...m,
                        isStreaming: false,
                        sources: sources ?? m.sources,
                      }
                    : m,
                ),
              }
            : c,
        ),
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, isStreaming: false }
                      : m,
                  ),
                }
              : c,
          ),
        );
      } else {
        const errorText = `⚠ ${(err as Error).message || "An error occurred. Is your backend running?"}`;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: errorText, isStreaming: false }
                      : m,
                  ),
                }
              : c,
          ),
        );
      }
    } finally {
      delete abortControllersRef.current[convId];
      setStreamingConversationIds((prev) => prev.filter((id) => id !== convId));
    }
  }, [
    inputValue,
    isActiveStreaming,
    activeConversationId,
    activeConversation?.projectId,
    activeProjectId,
    conversations,
    selectedModel,
    webSearchEnabled,
  ]);

  const handleRetry = useCallback(async () => {
    if (!activeConversationId || isActiveStreaming) return;
    const convId = activeConversationId;
    const currentConv = conversations.find((c) => c.id === convId);
    if (!currentConv || currentConv.messages.length === 0) return;

    const lastMsg = currentConv.messages[currentConv.messages.length - 1];
    
    let updatedConversations = conversations;
    let assistantMsg: Message;
    
    if (lastMsg.role === "assistant") {
      assistantMsg = {
        ...lastMsg,
        content: "",
        isStreaming: true,
        sources: undefined
      };
      
      updatedConversations = conversations.map(c => 
        c.id === convId ? {
          ...c,
          messages: [...c.messages.slice(0, -1), assistantMsg],
          updatedAt: Date.now(),
        } : c
      );
    } else {
      assistantMsg = {
        id: generateMessageId("assistant"),
        role: "assistant",
        content: "",
        isStreaming: true,
      };
      updatedConversations = conversations.map(c => 
        c.id === convId ? {
          ...c,
          messages: [...c.messages, assistantMsg],
          updatedAt: Date.now(),
        } : c
      );
    }

    setConversations(updatedConversations);
    setStreamingConversationIds((prev) => [...prev, convId]);

    const updatedConv = updatedConversations.find((c) => c.id === convId);
    const apiMessages = (updatedConv?.messages ?? [])
      .filter((m) => m.content.length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

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
              projectId: updatedConv?.projectId || undefined,
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
          
          break; // Success, exit retry loop
        } catch (err) {
          if ((err as Error).name === "AbortError" || retries >= MAX_RETRIES) {
            throw err;
          }
          retries++;
          // Wait 2 seconds before retrying
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      let sources: SourceCitation[] | undefined;
      const sourcesHeader = response.headers.get("Cogito-Sources");
      if (sourcesHeader) {
        try {
          sources = JSON.parse(
            decodeURIComponent(sourcesHeader),
          ) as SourceCitation[];
        } catch {
          sources = undefined;
        }
      }

      if (sources && sources.length > 0) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsg.id ? { ...m, sources } : m,
                  ),
                }
              : c,
          ),
        );
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          content: accumulated,
                          isStreaming: true,
                          sources: sources ?? m.sources,
                        }
                      : m,
                  ),
                }
              : c,
          ),
        );
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                updatedAt: Date.now(),
                messages: c.messages.map((m) =>
                  m.id === assistantMsg.id
                    ? {
                        ...m,
                        isStreaming: false,
                        sources: sources ?? m.sources,
                      }
                    : m,
                ),
              }
            : c,
        ),
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, isStreaming: false }
                      : m,
                  ),
                }
              : c,
          ),
        );
      } else {
        const errorText = `⚠ ${(err as Error).message || "An error occurred. Is your backend running?"}`;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) =>
                    m.id === assistantMsg.id
                      ? { ...m, content: errorText, isStreaming: false }
                      : m,
                  ),
                }
              : c,
          ),
        );
      }
    } finally {
      delete abortControllersRef.current[convId];
      setStreamingConversationIds((prev) => prev.filter((id) => id !== convId));
    }
  }, [
    isActiveStreaming,
    activeConversationId,
    conversations,
    selectedModel,
    webSearchEnabled,
  ]);

  const handleStop = useCallback(() => {
    if (activeConversationId) {
      abortControllersRef.current[activeConversationId]?.abort();
    }
  }, [activeConversationId]);

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
  }, [activeConversationId, isHydrated]);

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
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--surface-app)" }}>
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={handleNewChat}
        conversations={sidebarConversations}
        onSelectConversation={handleSelectConversation}
        onOpenSettings={() => setShowSettings(true)}
        onOpenProjects={handleOpenProjects}
        onOpenChats={() => setMainView("chat")}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopBar
          isSidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(true)}
        />
        
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden w-full">
          {/* Main Chat/Project Column */}
          <div className={`flex flex-col min-w-0 transition-all duration-300 ease-in-out ${activeArtifact ? "w-1/2 border-r border-[var(--border-subtle)]" : "w-full"}`}>
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
            <ChatThread messages={messages} onRetry={handleRetry} />

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
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
