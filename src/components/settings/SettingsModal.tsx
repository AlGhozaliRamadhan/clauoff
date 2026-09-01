"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  SettingsIcon,
  SearchIcon,
  ShieldCheckIcon,
  DatabaseIcon,
  UserPlusIcon,
  LockIcon,
  CheckIcon,
  SpeakerWaveIcon,
  SpeakerStopIcon,
  SkillsIcon,
  SparklesIcon,
  RefreshIcon,
  TrashIcon,
  PencilIcon,
  PlusIcon,
} from "@/components/ui/Icons";
import { useAuth } from "@/contexts/AuthContext";
import { useAudio } from "@/contexts/AudioContext";
import { AVATAR_COLORS } from "@/lib/auth/types";
import { MarkdownRenderer } from "@/components/artifacts/MarkdownRenderer";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

// Mirrors ApiProfile from /api/config/route.ts — kept local to avoid server import
interface LocalApiProfile {
  id: string;
  name: string;
  backendUrl: string;
  apiKey: string;
  defaultModel: string;
}

// Icons specific to settings tabs
function UserIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CreditCardIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function CapabilitiesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function CodeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function ConnectorsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function ApiIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function PluginsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5z" />
      <path d="M12 7v6" />
      <path d="M9 10h6" />
    </svg>
  );
}

// Appearance preference icons
function MonitorIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function SunIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function SettingsModal({ isOpen, onClose, initialTab }: SettingsModalProps) {
  const { user, openAuthModal, logout, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(initialTab || "general");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (initialTab && isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);
  
  // Account tab states
  const [accountDisplayName, setAccountDisplayName] = useState<string>("");
  const [accountAvatarColor, setAccountAvatarColor] = useState<string>(AVATAR_COLORS[0]);
  const [accountPassword, setAccountPassword] = useState<string>("");
  const [accountStatus, setAccountStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isUpdatingAccount, setIsUpdatingAccount] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      setAccountDisplayName(user.displayName);
      setAccountAvatarColor(user.avatarColor || AVATAR_COLORS[0]);
    }
  }, [user]);

  // ── Skills Tab States ──────────────────────────────────────────
  interface LocalSkill {
    name: string;
    description: string;
    license?: string;
    compatibility?: string;
    allowedTools?: string[];
    metadata?: Record<string, string>;
    source?: "builtin" | "custom" | "downloaded" | "github";
    sourceUrl?: string;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
    path?: string;
    content: string;
    instructions: string;
  }

  interface LocalCuratedSkill {
    id: string;
    name: string;
    description: string;
    category: string;
    author: string;
    tags: string[];
    skillMd: string;
  }

  const [skillsList, setSkillsList] = useState<LocalSkill[]>([]);
  const [curatedList, setCuratedList] = useState<LocalCuratedSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState<boolean>(false);
  const [skillsSubTab, setSkillsSubTab] = useState<"installed" | "catalog">("installed");
  const [skillSearch, setSkillSearch] = useState<string>("");
  const [catalogCategory, setCatalogCategory] = useState<string>("All");

  // In-place navigation: "list" | "detail" | "edit"
  const [skillsViewMode, setSkillsViewMode] = useState<"list" | "detail" | "edit">("list");
  const [detailTab, setDetailTab] = useState<"rendered" | "raw">("rendered");
  const [selectedSkill, setSelectedSkill] = useState<{
    name: string;
    description: string;
    content: string;
    instructions: string;
    license?: string;
    compatibility?: string;
    allowedTools?: string[];
    source?: string;
    sourceUrl?: string;
    isInstalled: boolean;
    isCurated?: boolean;
    curatedItem?: LocalCuratedSkill;
  } | null>(null);
  const [copiedRaw, setCopiedRaw] = useState<boolean>(false);

  // In-place Skill Editor
  const [editSkill, setEditSkill] = useState<{
    isNew: boolean;
    name: string;
    description: string;
    license: string;
    compatibility: string;
    allowedTools: string;
    instructions: string;
  } | null>(null);
  const [editSkillError, setEditSkillError] = useState<string>("");
  const [isSavingSkill, setIsSavingSkill] = useState<boolean>(false);

  // In-place Collapsible Download Panel
  const [showDownloadPanel, setShowDownloadPanel] = useState<boolean>(false);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [downloadCustomName, setDownloadCustomName] = useState<string>("");
  const [downloadStatus, setDownloadStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  const [installingCuratedId, setInstallingCuratedId] = useState<string | null>(null);
  const [skillActionMessage, setSkillActionMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchSkillsList = useCallback(async () => {
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      if (res.ok) {
        setSkillsList(data.skills ?? []);
        setCuratedList(data.curated ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch skills:", err);
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && (activeTab === "skills" || initialTab === "skills")) {
      fetchSkillsList();
    }
  }, [isOpen, activeTab, initialTab, fetchSkillsList]);

  const handleToggleSkill = async (name: string, enabled: boolean) => {
    setSkillsList((prev) =>
      prev.map((s) => (s.name === name ? { ...s, enabled } : s))
    );
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        throw new Error("Failed to toggle skill state");
      }
    } catch (err) {
      setSkillsList((prev) =>
        prev.map((s) => (s.name === name ? { ...s, enabled: !enabled } : s))
      );
      setSkillActionMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to toggle skill",
      });
      setTimeout(() => setSkillActionMessage(null), 3000);
    }
  };

  const handleDeleteSkill = async (name: string) => {
    if (!confirm(`Are you sure you want to delete skill "${name}"?`)) return;
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSkillsList((prev) => prev.filter((s) => s.name !== name));
        if (selectedSkill?.name === name) {
          setSelectedSkill(null);
          setSkillsViewMode("list");
        }
        setSkillActionMessage({ type: "success", message: `Skill "${name}" deleted.` });
        setTimeout(() => setSkillActionMessage(null), 3000);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete skill");
      }
    } catch (err) {
      setSkillActionMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete skill",
      });
      setTimeout(() => setSkillActionMessage(null), 3000);
    }
  };

  const handleInstallCurated = async (curated: LocalCuratedSkill) => {
    setInstallingCuratedId(curated.id);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: curated.name,
          content: curated.skillMd,
          source: "builtin",
          enabled: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchSkillsList();
        if (selectedSkill?.name === curated.name) {
          setSelectedSkill((prev) => (prev ? { ...prev, isInstalled: true } : null));
        }
        setSkillActionMessage({
          type: "success",
          message: `Installed skill "${curated.name}" successfully!`,
        });
        setTimeout(() => setSkillActionMessage(null), 3500);
      } else {
        throw new Error(data.error || "Failed to install skill");
      }
    } catch (err) {
      setSkillActionMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to install skill",
      });
      setTimeout(() => setSkillActionMessage(null), 3500);
    } finally {
      setInstallingCuratedId(null);
    }
  };

  const handleDownloadSkill = async () => {
    if (!downloadUrl.trim()) return;
    setDownloadStatus({ type: "loading" });
    try {
      const res = await fetch("/api/skills/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: downloadUrl.trim(),
          name: downloadCustomName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDownloadStatus({ type: "success", message: data.message || "Skill installed successfully!" });
        await fetchSkillsList();
        setTimeout(() => {
          setShowDownloadPanel(false);
          setDownloadUrl("");
          setDownloadCustomName("");
          setDownloadStatus({ type: "idle" });
        }, 1500);
      } else {
        setDownloadStatus({ type: "error", message: data.error || "Download failed" });
      }
    } catch (err) {
      setDownloadStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Download failed",
      });
    }
  };

  const handleSaveEditSkill = async () => {
    if (!editSkill) return;
    const name = editSkill.name.trim().toLowerCase();
    if (!name) {
      setEditSkillError("Skill name is required.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(name) || name.startsWith("-") || name.endsWith("-") || name.includes("--")) {
      setEditSkillError("Skill name must contain lowercase alphanumeric characters and hyphens only (e.g. code-reviewer).");
      return;
    }
    setIsSavingSkill(true);
    setEditSkillError("");
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: editSkill.description.trim(),
          license: editSkill.license.trim() || undefined,
          compatibility: editSkill.compatibility.trim() || undefined,
          allowedTools: editSkill.allowedTools
            ? editSkill.allowedTools.split(/[\s,]+/).filter(Boolean)
            : undefined,
          instructions: editSkill.instructions.trim(),
          source: editSkill.isNew ? "custom" : undefined,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchSkillsList();
        setSkillsViewMode("list");
        setEditSkill(null);
        setSelectedSkill(null);
        setSkillActionMessage({
          type: "success",
          message: `Skill "${name}" saved successfully!`,
        });
        setTimeout(() => setSkillActionMessage(null), 3000);
      } else {
        setEditSkillError(data.error || "Failed to save skill");
      }
    } catch (err) {
      setEditSkillError(err instanceof Error ? err.message : "Failed to save skill");
    } finally {
      setIsSavingSkill(false);
    }
  };

  // ── Connectors & MCP Tab States ───────────────────────────────────
  interface LocalConnectorTool {
    name: string;
    description: string;
    usage?: string;
    parameters?: any;
    inputSchema?: any;
  }

  interface LocalConnector {
    id: string;
    name: string;
    description: string;
    type: "builtin" | "mcp_stdio" | "mcp_sse" | "custom_http";
    category: "search" | "security" | "developer" | "data" | "mcp" | "custom";
    enabled: boolean;
    status: "ready" | "connected" | "error" | "disabled";
    statusMessage?: string;
    icon?: string;
    config: {
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
      headers?: Record<string, string>;
      apiKey?: string;
      timeoutMs?: number;
      [key: string]: any;
    };
    tools: LocalConnectorTool[];
    createdAt: number;
    updatedAt: number;
  }

  interface LocalConnectorPreset {
    id: string;
    name: string;
    description: string;
    type: "builtin" | "mcp_stdio" | "mcp_sse" | "custom_http";
    category: "search" | "security" | "developer" | "data" | "mcp" | "custom";
    icon: string;
    defaultConfig: Record<string, any>;
    defaultTools: LocalConnectorTool[];
  }

  const [connectorsList, setConnectorsList] = useState<LocalConnector[]>([]);
  const [connectorPresets, setConnectorPresets] = useState<LocalConnectorPreset[]>([]);
  const [connectorsLoading, setConnectorsLoading] = useState<boolean>(false);
  const [connectorsSubTab, setConnectorsSubTab] = useState<"active" | "catalog">("active");
  const [connectorCategoryFilter, setConnectorCategoryFilter] = useState<string>("All");
  const [connectorSearch, setConnectorSearch] = useState<string>("");

  // In-place navigation: "list" | "detail" | "edit"
  const [connectorsViewMode, setConnectorsViewMode] = useState<"list" | "detail" | "edit">("list");
  const [selectedConnector, setSelectedConnector] = useState<LocalConnector | null>(null);

  // Testing & Status
  const [testingConnectorId, setTestingConnectorId] = useState<string | null>(null);
  const [connectorTestResults, setConnectorTestResults] = useState<Record<string, { success: boolean; message: string; latencyMs?: number }>>({});
  const [connectorActionMessage, setConnectorActionMessage] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // In-place Editor
  const [editConnector, setEditConnector] = useState<{
    isNew: boolean;
    id: string;
    name: string;
    description: string;
    type: "builtin" | "mcp_stdio" | "mcp_sse" | "custom_http";
    category: "search" | "security" | "developer" | "data" | "mcp" | "custom";
    command: string;
    args: string;
    env: string;
    url: string;
    headers: string;
    timeoutMs: number;
  } | null>(null);
  const [isSavingConnector, setIsSavingConnector] = useState<boolean>(false);
  const [editConnectorError, setEditConnectorError] = useState<string>("");

  const fetchConnectorsList = useCallback(async () => {
    setConnectorsLoading(true);
    try {
      const res = await fetch("/api/connectors");
      const data = await res.json();
      if (res.ok) {
        setConnectorsList(data.connectors ?? []);
        setConnectorPresets(data.presets ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch connectors:", err);
    } finally {
      setConnectorsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && (activeTab === "connectors" || initialTab === "connectors")) {
      fetchConnectorsList();
    }
  }, [isOpen, activeTab, initialTab, fetchConnectorsList]);

  const handleToggleConnector = async (id: string, enabled: boolean) => {
    setConnectorsList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled } : c))
    );
    try {
      const res = await fetch(`/api/connectors/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle connector");
    } catch (err) {
      setConnectorsList((prev) =>
        prev.map((c) => (c.id === id ? { ...c, enabled: !enabled } : c))
      );
      setConnectorActionMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to toggle connector",
      });
      setTimeout(() => setConnectorActionMessage(null), 3000);
    }
  };

  const handleTestConnector = async (id: string) => {
    setTestingConnectorId(id);
    try {
      const res = await fetch(`/api/connectors/${encodeURIComponent(id)}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setConnectorTestResults((prev) => ({
        ...prev,
        [id]: {
          success: data.success,
          message: data.message || (data.success ? "Connection operational" : "Connection failed"),
          latencyMs: data.latencyMs,
        },
      }));
      await fetchConnectorsList();
    } catch (err) {
      setConnectorTestResults((prev) => ({
        ...prev,
        [id]: {
          success: false,
          message: err instanceof Error ? err.message : "Test request failed",
        },
      }));
    } finally {
      setTestingConnectorId(null);
    }
  };

  const handleDeleteConnector = async (id: string) => {
    if (!confirm("Are you sure you want to delete this custom connector?")) return;
    try {
      const res = await fetch(`/api/connectors/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setConnectorsList((prev) => prev.filter((c) => c.id !== id));
        if (selectedConnector?.id === id) {
          setSelectedConnector(null);
          setConnectorsViewMode("list");
        }
        setConnectorActionMessage({ type: "success", message: "Connector deleted successfully." });
        setTimeout(() => setConnectorActionMessage(null), 3000);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete connector");
      }
    } catch (err) {
      setConnectorActionMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete connector",
      });
      setTimeout(() => setConnectorActionMessage(null), 3000);
    }
  };

  const handleSaveEditConnector = async () => {
    if (!editConnector) return;
    if (!editConnector.name.trim()) {
      setEditConnectorError("Connector name is required.");
      return;
    }

    let parsedEnv: Record<string, string> = {};
    if (editConnector.env.trim()) {
      try {
        parsedEnv = JSON.parse(editConnector.env.trim());
      } catch {
        // Fallback: parse KEY=VALUE lines
        const lines = editConnector.env.split("\n");
        for (const line of lines) {
          const [k, ...v] = line.split("=");
          if (k && v) parsedEnv[k.trim()] = v.join("=").trim();
        }
      }
    }

    let parsedHeaders: Record<string, string> = {};
    if (editConnector.headers.trim()) {
      try {
        parsedHeaders = JSON.parse(editConnector.headers.trim());
      } catch {
        setEditConnectorError("Headers must be valid JSON (e.g. {\"Authorization\": \"Bearer ...\"})");
        return;
      }
    }

    let parsedArgs: string[] = [];
    if (editConnector.args.trim()) {
      parsedArgs = editConnector.args.split(/\s+/).filter(Boolean);
    }

    setIsSavingConnector(true);
    setEditConnectorError("");

    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editConnector.isNew ? undefined : editConnector.id,
          name: editConnector.name.trim(),
          description: editConnector.description.trim(),
          type: editConnector.type,
          category: editConnector.category,
          enabled: true,
          config: {
            command: editConnector.command.trim() || undefined,
            args: parsedArgs.length > 0 ? parsedArgs : undefined,
            env: Object.keys(parsedEnv).length > 0 ? parsedEnv : undefined,
            url: editConnector.url.trim() || undefined,
            headers: Object.keys(parsedHeaders).length > 0 ? parsedHeaders : undefined,
            timeoutMs: editConnector.timeoutMs || 30000,
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        await fetchConnectorsList();
        setConnectorsViewMode("list");
        setEditConnector(null);
        setSelectedConnector(null);
        setConnectorActionMessage({
          type: "success",
          message: `Connector "${editConnector.name}" saved successfully!`,
        });
        setTimeout(() => setConnectorActionMessage(null), 3000);
      } else {
        setEditConnectorError(data.error || "Failed to save connector");
      }
    } catch (err) {
      setEditConnectorError(err instanceof Error ? err.message : "Failed to save connector");
    } finally {
      setIsSavingConnector(false);
    }
  };

  // ── Plugins Tab States ──────────────────────────────────────────
  interface LocalPlugin {
    id: string;
    name: string;
    version: string;
    description: string;
    author?: string;
    license?: string;
    repository?: string;
    homepage?: string;
    category: "development" | "security" | "devops" | "data" | "productivity" | "custom";
    enabled: boolean;
    source: "builtin" | "marketplace" | "github" | "custom";
    sourceUrl?: string;
    manifest: any;
    bundledSkills: Array<{
      name: string;
      description: string;
      path: string;
      content: string;
      instructions: string;
    }>;
    bundledMcpServers: Array<{
      name: string;
      type: "mcp_stdio" | "mcp_sse";
      config: Record<string, any>;
      toolsCount: number;
    }>;
    installedAt: number;
    updatedAt: number;
  }

  interface LocalCuratedPlugin {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    category: "development" | "security" | "devops" | "data" | "productivity";
    tags: string[];
    homepage?: string;
    repository?: string;
    manifest: any;
    skills: Array<{ name: string; description: string; skillMd: string }>;
    mcpServers?: Record<string, any>;
  }

  const [pluginsList, setPluginsList] = useState<LocalPlugin[]>([]);
  const [curatedPluginsList, setCuratedPluginsList] = useState<LocalCuratedPlugin[]>([]);
  const [pluginsLoading, setPluginsLoading] = useState<boolean>(false);
  const [pluginsSubTab, setPluginsSubTab] = useState<"installed" | "catalog">("installed");
  const [pluginCategoryFilter, setPluginCategoryFilter] = useState<string>("All");
  const [pluginSearch, setPluginSearch] = useState<string>("");

  // In-place navigation: "list" | "detail"
  const [pluginsViewMode, setPluginsViewMode] = useState<"list" | "detail">("list");
  const [selectedPlugin, setSelectedPlugin] = useState<LocalPlugin | null>(null);
  const [pluginDetailTab, setPluginDetailTab] = useState<"skills" | "mcp" | "manifest">("skills");
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);

  // Download from GitHub / URL
  const [showPluginDownloadPanel, setShowPluginDownloadPanel] = useState<boolean>(false);
  const [pluginDownloadUrl, setPluginDownloadUrl] = useState<string>("");
  const [pluginDownloadName, setPluginDownloadName] = useState<string>("");
  const [pluginDownloadStatus, setPluginDownloadStatus] = useState<{
    type: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({ type: "idle" });
  const [pluginActionMessage, setPluginActionMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchPluginsList = useCallback(async () => {
    setPluginsLoading(true);
    try {
      const res = await fetch("/api/plugins");
      const data = await res.json();
      if (res.ok) {
        setPluginsList(data.plugins ?? []);
        setCuratedPluginsList(data.curated ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch plugins:", err);
    } finally {
      setPluginsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && (activeTab === "plugins" || initialTab === "plugins")) {
      fetchPluginsList();
    }
  }, [isOpen, activeTab, initialTab, fetchPluginsList]);

  const handleTogglePlugin = async (id: string, enabled: boolean) => {
    setPluginsList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled } : p))
    );
    try {
      const res = await fetch(`/api/plugins/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Failed to toggle plugin state");
      await fetchPluginsList();
    } catch (err) {
      setPluginsList((prev) =>
        prev.map((p) => (p.id === id ? { ...p, enabled: !enabled } : p))
      );
      setPluginActionMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to toggle plugin",
      });
      setTimeout(() => setPluginActionMessage(null), 3000);
    }
  };

  const handleInstallCuratedPlugin = async (id: string) => {
    setInstallingPluginId(id);
    try {
      const res = await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchPluginsList();
        setPluginActionMessage({
          type: "success",
          message: data.message || `Plugin "${id}" installed successfully!`,
        });
        setTimeout(() => setPluginActionMessage(null), 3000);
      } else {
        throw new Error(data.error || "Failed to install plugin");
      }
    } catch (err) {
      setPluginActionMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to install plugin",
      });
      setTimeout(() => setPluginActionMessage(null), 3000);
    } finally {
      setInstallingPluginId(null);
    }
  };

  const handleDeletePlugin = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to uninstall and delete plugin "${name}"?`)) return;
    try {
      const res = await fetch(`/api/plugins/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPluginsList((prev) => prev.filter((p) => p.id !== id));
        if (selectedPlugin?.id === id) {
          setSelectedPlugin(null);
          setPluginsViewMode("list");
        }
        setPluginActionMessage({ type: "success", message: `Plugin "${name}" uninstalled.` });
        setTimeout(() => setPluginActionMessage(null), 3000);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to uninstall plugin");
      }
    } catch (err) {
      setPluginActionMessage({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to delete plugin",
      });
      setTimeout(() => setPluginActionMessage(null), 3000);
    }
  };

  const handleDownloadPlugin = async () => {
    if (!pluginDownloadUrl.trim()) return;
    setPluginDownloadStatus({ type: "loading", message: "Fetching plugin repository and bundle..." });

    try {
      const res = await fetch("/api/plugins/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: pluginDownloadUrl.trim(),
          name: pluginDownloadName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.plugin) {
        setPluginDownloadStatus({
          type: "success",
          message: data.message || `Plugin "${data.plugin.name}" downloaded successfully!`,
        });
        setPluginDownloadUrl("");
        setPluginDownloadName("");
        await fetchPluginsList();
        setTimeout(() => {
          setPluginDownloadStatus({ type: "idle" });
          setShowPluginDownloadPanel(false);
        }, 2000);
      } else {
        setPluginDownloadStatus({
          type: "error",
          message: data.error || "Failed to download plugin.",
        });
      }
    } catch (err) {
      setPluginDownloadStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Network error downloading plugin.",
      });
    }
  };

  // Settings Form States (General tab)
  const [fullName, setFullName] = useState<string>("Al Ghozali Ramadhan");
  const [nickname, setNickname] = useState<string>("oza");
  const [workType, setWorkType] = useState<string>("Developer");
  const [instructions, setInstructions] = useState<string>("");
  const [appearance, setAppearance] = useState<"system" | "light" | "dark">("dark");
  const [chatFont, setChatFont] = useState<string>("Cogito Serif");

  const [showWorkDropdown, setShowWorkDropdown] = useState<boolean>(false);
  const [showFontDropdown, setShowFontDropdown] = useState<boolean>(false);
  const [showVoiceDropdown, setShowVoiceDropdown] = useState<boolean>(false);

  // Audio Context
  const {
    voiceSettings,
    updateVoiceSettings,
    availableVoices,
    playVoice,
    stopVoice,
    isPlaying,
    isGenerating,
    activeId,
  } = useAudio();

  // API tab state — multi-profile
  const [apiProfiles, setApiProfiles] = useState<LocalApiProfile[]>([]);
  const [apiActiveId, setApiActiveId] = useState<string | null>(null);
  const [apiSelectedId, setApiSelectedId] = useState<string | "new" | null>(null);
  const [editForm, setEditForm] = useState({ name: "", backendUrl: "", apiKey: "", defaultModel: "" });
  const [showEditApiKey, setShowEditApiKey] = useState<boolean>(false);
  const [apiSaveStatus, setApiSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [apiTestStatus, setApiTestStatus] = useState<"idle" | "testing" | "ok" | "error">("idle");
  const [apiTestMessage, setApiTestMessage] = useState<string>("");
  const [apiModels, setApiModels] = useState<string[]>([]);
  const [apiModelsLoading, setApiModelsLoading] = useState<boolean>(false);
  const [apiModelsError, setApiModelsError] = useState<string>("");
  const apiSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Privacy tab states
  const [locationEnabled, setLocationEnabled] = useState<boolean>(false);
  const [trainEnabled, setTrainEnabled] = useState<boolean>(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedFullName = localStorage.getItem("cogito.fullname.v1");
      const storedNickname = localStorage.getItem("cogito.nickname.v1");
      const storedWorkType = localStorage.getItem("cogito.worktype.v1");
      const storedInstructions = localStorage.getItem("cogito.instructions.v1");
      const storedAppearance = localStorage.getItem("cogito.theme.v1") as "system" | "light" | "dark" | null;
      const storedFont = localStorage.getItem("cogito.font.v1");
      const storedLocation = localStorage.getItem("cogito.privacy.location.v1");
      const storedTrain = localStorage.getItem("cogito.privacy.train.v1");

      if (storedFullName) setTimeout(() => setFullName(storedFullName), 0);
      if (storedNickname) setTimeout(() => setNickname(storedNickname), 0);
      if (storedWorkType) setTimeout(() => setWorkType(storedWorkType), 0);
      if (storedInstructions) setTimeout(() => setInstructions(storedInstructions), 0);
      if (storedAppearance) setTimeout(() => setAppearance(storedAppearance), 0);
      if (storedFont) setTimeout(() => {
        setChatFont(storedFont);
        const root = document.documentElement;
        if (storedFont === "System Sans-Serif") {
          root.style.setProperty("--font-body", "var(--font-ui)");
        } else if (storedFont === "Mono") {
          root.style.setProperty("--font-body", "var(--font-mono)");
        } else {
          // Default: Cogito Serif
          root.style.setProperty("--font-body", "var(--font-display)");
        }
      }, 0);
      if (storedLocation) setTimeout(() => setLocationEnabled(storedLocation === "true"), 0);
      if (storedTrain) setTimeout(() => setTrainEnabled(storedTrain === "true"), 0);
    }
  }, []);

  // Load API profiles from server on mount
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setApiProfiles(data.profiles ?? []);
        setApiActiveId(data.activeId ?? null);
      })
      .catch(() => {});
  }, []);

  const handleLocationToggle = (val: boolean) => {
    setLocationEnabled(val);
    localStorage.setItem("cogito.privacy.location.v1", val ? "true" : "false");
  };

  const handleTrainToggle = (val: boolean) => {
    setTrainEnabled(val);
    localStorage.setItem("cogito.privacy.train.v1", val ? "true" : "false");
  };

  // Update appearance context (HTML data-theme attribute)
  const handleAppearanceChange = (theme: "system" | "light" | "dark") => {
    setAppearance(theme);
    localStorage.setItem("cogito.theme.v1", theme);
    
    const root = document.documentElement;
    if (theme === "light") {
      root.setAttribute("data-theme", "light");
    } else if (theme === "dark") {
      root.removeAttribute("data-theme");
    } else {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        root.removeAttribute("data-theme");
      } else {
        root.setAttribute("data-theme", "light");
      }
    }
  };

  // Helper to set chat font theme on HTML element
  const setFontTheme = (font: string) => {
    setChatFont(font);
    localStorage.setItem("cogito.font.v1", font);
    const root = document.documentElement;
    if (font === "System Sans-Serif") {
      root.style.setProperty("--font-body", "var(--font-ui)");
    } else if (font === "Mono") {
      root.style.setProperty("--font-body", "var(--font-mono)");
    } else {
      // Default: Cogito Serif
      root.style.setProperty("--font-body", "var(--font-display)");
    }
  };

  // Save textual profile fields to LocalStorage
  const handleSaveFullName = (val: string) => {
    setFullName(val);
    localStorage.setItem("cogito.fullname.v1", val);
  };

  const handleSaveNickname = (val: string) => {
    setNickname(val);
    localStorage.setItem("cogito.nickname.v1", val);
    
    // Dispatch custom event to let EmptyState re-render immediately
    window.dispatchEvent(new Event("cogito-nickname-changed"));
  };

  const handleSaveInstructions = (val: string) => {
    setInstructions(val);
    localStorage.setItem("cogito.instructions.v1", val);
  };

  const handleSaveWorkType = (val: string) => {
    setWorkType(val);
    localStorage.setItem("cogito.worktype.v1", val);
    setShowWorkDropdown(false);
  };

  // ── API Profile helpers ─────────────────────────────────────────

  /** Push the full profiles list + activeId to the server */
  const persistProfiles = async (
    profiles: LocalApiProfile[],
    activeId: string | null,
  ) => {
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profiles, activeId }),
    });
  };

  const handleSelectProfile = (id: string) => {
    const p = apiProfiles.find((x) => x.id === id);
    if (!p) return;
    setApiSelectedId(id);
    setEditForm({ name: p.name, backendUrl: p.backendUrl, apiKey: p.apiKey, defaultModel: p.defaultModel });
    setApiModels([]);
    setApiModelsError("");
    setApiTestStatus("idle");
    setApiTestMessage("");
  };

  const handleAddNew = () => {
    setApiSelectedId("new");
    setEditForm({ name: "", backendUrl: "", apiKey: "", defaultModel: "" });
    setApiModels([]);
    setApiModelsError("");
    setApiTestStatus("idle");
    setApiTestMessage("");
  };

  const handleCancelEdit = () => {
    setApiSelectedId(null);
    setApiModels([]);
  };

  /** Save the edit form as a new or updated profile */
  const handleSaveProfile = async () => {
    if (apiSaveTimerRef.current) clearTimeout(apiSaveTimerRef.current);
    setApiSaveStatus("saving");
    let nextProfiles: LocalApiProfile[];
    let nextActiveId = apiActiveId;

    if (apiSelectedId === "new") {
      const newId = typeof crypto !== "undefined" ? crypto.randomUUID() : `profile-${Date.now()}`;
      const newProfile: LocalApiProfile = { id: newId, ...editForm };
      nextProfiles = [...apiProfiles, newProfile];
      // Auto-activate if this is the first profile
      if (nextProfiles.length === 1) nextActiveId = newId;
    } else {
      nextProfiles = apiProfiles.map((p) =>
        p.id === apiSelectedId ? { ...p, ...editForm } : p,
      );
    }

    try {
      await persistProfiles(nextProfiles, nextActiveId);
      setApiProfiles(nextProfiles);
      setApiActiveId(nextActiveId);
      setApiSaveStatus("saved");
      if (apiSelectedId === "new") setApiSelectedId(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cogito:profile-changed"));
      }
      apiSaveTimerRef.current = setTimeout(() => setApiSaveStatus("idle"), 2500);
    } catch {
      setApiSaveStatus("error");
      apiSaveTimerRef.current = setTimeout(() => setApiSaveStatus("idle"), 3000);
    }
  };

  /** Delete a profile (can't delete the last one) */
  const handleDeleteProfile = async (id: string) => {
    if (apiProfiles.length <= 1) return;
    const nextProfiles = apiProfiles.filter((p) => p.id !== id);
    const nextActiveId =
      apiActiveId === id ? (nextProfiles[0]?.id ?? null) : apiActiveId;
    await persistProfiles(nextProfiles, nextActiveId);
    setApiProfiles(nextProfiles);
    setApiActiveId(nextActiveId);
    if (apiSelectedId === id) setApiSelectedId(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cogito:profile-changed"));
    }
  };

  /** Activate a profile — saves immediately */
  const handleSetActive = async (id: string) => {
    const nextActiveId = id;
    await persistProfiles(apiProfiles, nextActiveId);
    setApiActiveId(nextActiveId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cogito:profile-changed"));
    }
  };

  /** Fetch models: saves editForm as temp active, then calls /api/models */
  const fetchApiModels = async () => {
    setApiModelsLoading(true);
    setApiModelsError("");
    // Temporarily push the editForm values to the server so /api/models uses them
    try {
      // Build a temp profile list with editForm values active
      const tempProfile: LocalApiProfile = {
        id: "__temp__",
        name: editForm.name || "temp",
        backendUrl: editForm.backendUrl.trim(),
        apiKey: editForm.apiKey.trim(),
        defaultModel: editForm.defaultModel.trim(),
      };
      await persistProfiles([...apiProfiles, tempProfile], "__temp__");
    } catch { /* non-fatal */ }
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const ids: string[] = (data.models ?? []).map((m: { id: string }) => m.id);
      if (ids.length === 0) throw new Error("No models returned by the backend.");
      setApiModels(ids);
      if (editForm.defaultModel && !ids.includes(editForm.defaultModel)) {
        setEditForm((f) => ({ ...f, defaultModel: ids[0] }));
      }
    } catch (err) {
      setApiModelsError(err instanceof Error ? err.message : "Failed to fetch models.");
    } finally {
      // Restore the real profiles
      await persistProfiles(apiProfiles, apiActiveId).catch(() => {});
      setApiModelsLoading(false);
    }
  };

  /** Test the editForm endpoint — saves as temp active, calls /api/models */
  const handleTestConnection = async () => {
    setApiTestStatus("testing");
    setApiTestMessage("");
    try {
      const tempProfile: LocalApiProfile = {
        id: "__temp__",
        name: editForm.name || "temp",
        backendUrl: editForm.backendUrl.trim(),
        apiKey: editForm.apiKey.trim(),
        defaultModel: editForm.defaultModel.trim(),
      };
      await persistProfiles([...apiProfiles, tempProfile], "__temp__");
      const res = await fetch("/api/models");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const count = Array.isArray(data.models) ? data.models.length : 0;
      setApiTestStatus("ok");
      setApiTestMessage(`${count} model${count !== 1 ? "s" : ""} available`);
    } catch (err) {
      setApiTestStatus("error");
      setApiTestMessage(err instanceof Error ? err.message : "Connection failed");
    } finally {
      await persistProfiles(apiProfiles, apiActiveId).catch(() => {});
      setTimeout(() => setApiTestStatus("idle"), 6000);
    }
  };

  if (!isOpen) return null;

  // Filter tabs for search
  const tabs = [
    { id: "general", label: "General", icon: <SettingsIcon size={16} />, section: "settings" },
    { id: "api", label: "API", icon: <ApiIcon size={16} />, section: "settings" },
    { id: "account", label: "Account", icon: <UserIcon size={16} />, section: "settings" },
    { id: "privacy", label: "Privacy", icon: <ShieldIcon size={16} />, section: "settings" },
    { id: "billing", label: "Billing", icon: <CreditCardIcon size={16} />, section: "settings" },
    { id: "capabilities", label: "Capabilities", icon: <CapabilitiesIcon size={16} />, section: "settings" },
    { id: "code", label: "Cogito Code", icon: <CodeIcon size={16} />, section: "settings" },
    { id: "skills", label: "Skills", icon: <SkillsIcon size={16} />, section: "customize" },
    { id: "connectors", label: "Connectors", icon: <ConnectorsIcon size={16} />, section: "customize" },
    { id: "plugins", label: "Plugins", icon: <PluginsIcon size={16} />, section: "customize" },
  ];

  const filteredTabs = tabs.filter(tab => 
    tab.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      {/* Settings Panel Shell */}
      <div
        className="rounded-2xl w-full max-w-4xl h-[85vh] max-h-[640px] flex overflow-hidden border shadow-2xl relative animate-fade-in"
        style={{
          background: "var(--surface-app)",
          borderColor: "var(--border-subtle)",
        }}
      >
        {/* Left Sidebar Pane */}
        <div
          className="w-[220px] flex-shrink-0 flex flex-col p-3 border-r h-full overflow-y-auto"
          style={{
            background: "var(--surface-sidebar)",
            borderColor: "var(--border-subtle)",
          }}
        >
          {/* Search bar */}
          <div className="relative mb-4 w-full">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-60">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-50 focus:border-[var(--accent-primary)] transition-all"
            />
          </div>

          {/* Group 1: Settings */}
          {filteredTabs.some(t => t.section === "settings") && (
            <div className="flex flex-col gap-0.5 mb-5">
              <span className="px-3 mb-1 text-[11px] font-semibold text-[var(--text-secondary)] tracking-wider uppercase opacity-65">
                Settings
              </span>
              {filteredTabs
                .filter(t => t.section === "settings")
                .map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs-ui font-medium cursor-pointer transition-colors ${
                      activeTab === tab.id
                        ? "bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.02)]"
                    }`}
                  >
                    <span className="opacity-70">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
            </div>
          )}

          {/* Group 2: Customize */}
          {filteredTabs.some(t => t.section === "customize") && (
            <div className="flex flex-col gap-0.5">
              <span className="px-3 mb-1 text-[11px] font-semibold text-[var(--text-secondary)] tracking-wider uppercase opacity-65">
                Customize
              </span>
              {filteredTabs
                .filter(t => t.section === "customize")
                .map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs-ui font-medium cursor-pointer transition-colors ${
                      activeTab === tab.id
                        ? "bg-[rgba(255,255,255,0.06)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.02)]"
                    }`}
                  >
                    <span className="opacity-70">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Right Content Pane */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto h-full relative">
          {/* Close button top right */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.06)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            aria-label="Close settings"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Settings Tabs Router */}
          {activeTab === "api" ? (
            <div className="flex flex-col gap-4 max-w-2xl mt-2 pr-2 h-full overflow-y-auto">

              {/* ── Header ── */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">API Profiles</h2>
                  <p className="text-xs-ui text-[var(--text-secondary)] mt-0.5">
                    Manage multiple endpoints — switch instantly, no restart needed.
                  </p>
                </div>
                <button
                  id="api-add-profile-btn"
                  onClick={handleAddNew}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs-ui font-semibold transition-all cursor-pointer flex-shrink-0"
                  style={{ background: "var(--accent-primary)", color: "#fff" }}
                >
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  New Profile
                </button>
              </div>

              {/* ── Profile list ── */}
              <div className="flex flex-col gap-2">
                {apiProfiles.length === 0 && apiSelectedId !== "new" && (
                  <div
                    className="rounded-xl p-5 flex flex-col items-center justify-center gap-2 border border-dashed text-center"
                    style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
                  >
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <p className="text-xs-ui opacity-60">No profiles yet — click <strong>New Profile</strong> to add one.</p>
                  </div>
                )}

                {apiProfiles.map((profile) => {
                  const isActive = profile.id === apiActiveId;
                  const isEditing = profile.id === apiSelectedId;
                  return (
                    <div
                      key={profile.id}
                      className="rounded-xl border transition-all"
                      style={{
                        background: isEditing ? "rgba(201,96,63,0.05)" : "rgba(255,255,255,0.02)",
                        borderColor: isEditing ? "rgba(201,96,63,0.35)" : isActive ? "rgba(201,96,63,0.2)" : "var(--border-subtle)",
                      }}
                    >
                      {/* Card header row */}
                      <div className="flex items-center gap-3 px-3.5 py-3">
                        {/* Active indicator dot */}
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
                          style={{ background: isActive ? "#4ade80" : "rgba(255,255,255,0.12)" }}
                          title={isActive ? "Active" : "Inactive"}
                        />
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs-ui font-semibold text-[var(--text-primary)] truncate">{profile.name || "Unnamed"}</span>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>ACTIVE</span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono truncate mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {profile.backendUrl || <em className="not-italic opacity-40">no URL set</em>}
                          </p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {!isActive && (
                            <button
                              onClick={() => handleSetActive(profile.id)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                              style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)", background: "transparent" }}
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => isEditing ? handleCancelEdit() : handleSelectProfile(profile.id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors"
                            style={{
                              borderColor: isEditing ? "rgba(201,96,63,0.4)" : "var(--border-subtle)",
                              color: isEditing ? "var(--accent-primary)" : "var(--text-secondary)",
                              background: "transparent",
                            }}
                          >
                            {isEditing ? "Cancel" : "Edit"}
                          </button>
                        </div>
                      </div>

                      {/* ── Inline edit form ── */}
                      {isEditing && (
                        <div className="px-3.5 pb-4 flex flex-col gap-3 border-t" style={{ borderColor: "rgba(201,96,63,0.15)" }}>
                          <div className="h-3" />

                          {/* Name */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Profile Name</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              placeholder="e.g. Kaggle Session, Local LM Studio"
                              className="w-full px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] transition-colors"
                            />
                          </div>

                          {/* URL */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Backend URL</label>
                            <input
                              type="url"
                              value={editForm.backendUrl}
                              onChange={(e) => setEditForm((f) => ({ ...f, backendUrl: e.target.value }))}
                              placeholder="https://xxx.trycloudflare.com"
                              className="w-full px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] transition-colors font-mono"
                              spellCheck={false}
                              autoComplete="off"
                            />
                          </div>

                          {/* API Key */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">API Key</label>
                            <div className="relative">
                              <input
                                type={showEditApiKey ? "text" : "password"}
                                value={editForm.apiKey}
                                onChange={(e) => setEditForm((f) => ({ ...f, apiKey: e.target.value }))}
                                placeholder="cg-xxxx… (admin key from your Kaggle notebook)"
                                className="w-full px-3 py-1.5 pr-9 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] transition-colors font-mono"
                                spellCheck={false}
                                autoComplete="off"
                              />
                              <button
                                onClick={() => setShowEditApiKey((v) => !v)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                              >
                                {showEditApiKey ? (
                                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
                                  </svg>
                                ) : (
                                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Default Model */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Default Model</label>
                              <button
                                onClick={fetchApiModels}
                                disabled={apiModelsLoading}
                                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer disabled:opacity-50 transition-colors"
                                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)", background: "transparent" }}
                              >
                                {apiModelsLoading ? (
                                  <svg className="animate-spin" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                ) : (
                                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                                  </svg>
                                )}
                                {apiModelsLoading ? "Fetching…" : "Fetch"}
                              </button>
                            </div>
                            {apiModelsError && <p className="text-[10px]" style={{ color: "#f87171" }}>{apiModelsError}</p>}
                            {apiModels.length > 0 ? (
                              <div className="relative">
                                <select
                                  value={editForm.defaultModel}
                                  onChange={(e) => setEditForm((f) => ({ ...f, defaultModel: e.target.value }))}
                                  className="w-full px-3 py-1.5 pr-7 rounded-lg text-xs-ui appearance-none cursor-pointer font-mono"
                                  style={{ background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", outline: "none" }}
                                >
                                  <option value="">(auto — first available)</option>
                                  {apiModels.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-50">
                                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                                </span>
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={editForm.defaultModel}
                                onChange={(e) => setEditForm((f) => ({ ...f, defaultModel: e.target.value }))}
                                placeholder="(auto) or click Fetch to pick from list"
                                className="w-full px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] transition-colors font-mono"
                              />
                            )}
                          </div>

                          {/* Actions row */}
                          <div className="flex items-center gap-2 pt-1">
                            {/* Delete (only if more than 1 profile) */}
                            {apiProfiles.length > 1 && (
                              <button
                                onClick={() => handleDeleteProfile(profile.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors hover:border-red-500/40 hover:text-red-400"
                                style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)", background: "transparent" }}
                              >
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                                </svg>
                                Delete
                              </button>
                            )}

                            {/* Test */}
                            <button
                              onClick={handleTestConnection}
                              disabled={apiTestStatus === "testing"}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer disabled:opacity-50 transition-colors"
                              style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)", background: "transparent" }}
                            >
                              {apiTestStatus === "testing" ? (
                                <svg className="animate-spin" width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                              ) : (
                                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                </svg>
                              )}
                              {apiTestStatus === "testing" ? "Testing…" : "Test"}
                            </button>

                            {/* Test result badge */}
                            {apiTestStatus !== "idle" && apiTestStatus !== "testing" && (
                              <span
                                className="text-[10px] font-medium px-2 py-0.5 rounded"
                                style={{
                                  background: apiTestStatus === "ok" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                                  color: apiTestStatus === "ok" ? "#4ade80" : "#f87171",
                                }}
                              >
                                {apiTestStatus === "ok" ? "✓ " : "✗ "}{apiTestMessage}
                              </span>
                            )}

                            <div className="flex-1" />

                            {/* Save */}
                            <button
                              onClick={handleSaveProfile}
                              disabled={apiSaveStatus === "saving"}
                              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-60 transition-all"
                              style={{
                                background: apiSaveStatus === "saved" ? "rgba(34,197,94,0.15)" : apiSaveStatus === "error" ? "rgba(239,68,68,0.15)" : "var(--accent-primary)",
                                color: apiSaveStatus === "saved" ? "#4ade80" : apiSaveStatus === "error" ? "#f87171" : "#fff",
                              }}
                            >
                              {apiSaveStatus === "saving" && <svg className="animate-spin" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
                              {apiSaveStatus === "idle" && "Save"}
                              {apiSaveStatus === "saving" && "Saving…"}
                              {apiSaveStatus === "saved" && "✓ Saved"}
                              {apiSaveStatus === "error" && "✗ Error"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── New Profile form ── */}
              {apiSelectedId === "new" && (
                <div
                  className="rounded-xl border flex flex-col gap-3 p-3.5 animate-fade-in"
                  style={{ borderColor: "rgba(201,96,63,0.35)", background: "rgba(201,96,63,0.04)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs-ui font-semibold text-[var(--accent-primary)]">New Profile</span>
                    <button onClick={handleCancelEdit} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors">
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  {/* Name */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Profile Name</label>
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Kaggle Session, Local LM Studio"
                      className="w-full px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] transition-colors" />
                  </div>

                  {/* URL */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Backend URL</label>
                    <input type="url" value={editForm.backendUrl} onChange={(e) => setEditForm((f) => ({ ...f, backendUrl: e.target.value }))}
                      placeholder="https://xxx.trycloudflare.com"
                      className="w-full px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] transition-colors font-mono"
                      spellCheck={false} autoComplete="off" />
                  </div>

                  {/* API Key */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">API Key</label>
                    <div className="relative">
                      <input type={showEditApiKey ? "text" : "password"} value={editForm.apiKey} onChange={(e) => setEditForm((f) => ({ ...f, apiKey: e.target.value }))}
                        placeholder="cg-xxxx… (admin key from your Kaggle notebook)"
                        className="w-full px-3 py-1.5 pr-9 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] transition-colors font-mono"
                        spellCheck={false} autoComplete="off" />
                      <button onClick={() => setShowEditApiKey((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer">
                        {showEditApiKey ? (
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        ) : (
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Default Model */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Default Model</label>
                      <button onClick={fetchApiModels} disabled={apiModelsLoading}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer disabled:opacity-50 transition-colors"
                        style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)", background: "transparent" }}
                      >
                        {apiModelsLoading ? <svg className="animate-spin" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                          : <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>}
                        {apiModelsLoading ? "Fetching…" : "Fetch"}
                      </button>
                    </div>
                    {apiModelsError && <p className="text-[10px]" style={{ color: "#f87171" }}>{apiModelsError}</p>}
                    {apiModels.length > 0 ? (
                      <div className="relative">
                        <select value={editForm.defaultModel} onChange={(e) => setEditForm((f) => ({ ...f, defaultModel: e.target.value }))}
                          className="w-full px-3 py-1.5 pr-7 rounded-lg text-xs-ui appearance-none cursor-pointer font-mono"
                          style={{ background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", outline: "none" }}>
                          <option value="">(auto — first available)</option>
                          {apiModels.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-50"><svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg></span>
                      </div>
                    ) : (
                      <input type="text" value={editForm.defaultModel} onChange={(e) => setEditForm((f) => ({ ...f, defaultModel: e.target.value }))}
                        placeholder="(auto) or click Fetch to pick from list"
                        className="w-full px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] transition-colors font-mono" />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={handleTestConnection} disabled={apiTestStatus === "testing"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer disabled:opacity-50 transition-colors"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)", background: "transparent" }}
                    >
                      {apiTestStatus === "testing" ? <svg className="animate-spin" width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        : <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
                      {apiTestStatus === "testing" ? "Testing…" : "Test"}
                    </button>
                    {apiTestStatus !== "idle" && apiTestStatus !== "testing" && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded"
                        style={{ background: apiTestStatus === "ok" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: apiTestStatus === "ok" ? "#4ade80" : "#f87171" }}>
                        {apiTestStatus === "ok" ? "✓ " : "✗ "}{apiTestMessage}
                      </span>
                    )}
                    <div className="flex-1" />
                    <button onClick={handleSaveProfile} disabled={apiSaveStatus === "saving"}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-60 transition-all"
                      style={{ background: apiSaveStatus === "saved" ? "rgba(34,197,94,0.15)" : apiSaveStatus === "error" ? "rgba(239,68,68,0.15)" : "var(--accent-primary)", color: apiSaveStatus === "saved" ? "#4ade80" : apiSaveStatus === "error" ? "#f87171" : "#fff" }}
                    >
                      {apiSaveStatus === "saving" && <svg className="animate-spin" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
                      {apiSaveStatus === "idle" && "Add Profile"}
                      {apiSaveStatus === "saving" && "Saving…"}
                      {apiSaveStatus === "saved" && "✓ Added"}
                      {apiSaveStatus === "error" && "✗ Error"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Kaggle tip ── */}
              <div className="rounded-xl p-3.5 border" style={{ background: "rgba(201,96,63,0.05)", borderColor: "rgba(201,96,63,0.18)" }}>
                <div className="flex items-start gap-2.5">
                  <span className="text-sm mt-0.5">☁</span>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs-ui font-semibold text-[var(--accent-primary)]">Cloudflare Tunnel (Kaggle)</span>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      Each Kaggle session gives you a new URL + admin key.
                      Add a profile once, then just <strong>Edit</strong> it and paste the new values — no need to create a fresh profile every time.
                    </p>
                  </div>
                </div>
              </div>

            </div>

          ) : activeTab === "general" ? (
            <div className="flex flex-col gap-6 max-w-2xl mt-2 pr-2">
              {/* Profile Header */}
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">Profile</h2>
                <div className="w-full border-b border-[var(--border-subtle)] my-2" />
              </div>

              {/* Avatar row */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs-ui font-medium text-[var(--text-primary)]">Avatar</span>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: "var(--text-primary)",
                    color: "var(--surface-sidebar)",
                  }}
                >
                  AR
                </div>
              </div>

              {/* Full name row */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs-ui font-medium text-[var(--text-primary)]">Full name</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => handleSaveFullName(e.target.value)}
                  className="w-64 px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] focus:border-[var(--accent-primary)] transition-colors text-left"
                />
              </div>

              {/* Nickname row */}
              <div className="flex items-center justify-between py-1">
                <div className="flex flex-col">
                  <span className="text-xs-ui font-medium text-[var(--text-primary)]">What should Cogito call you?</span>
                </div>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => handleSaveNickname(e.target.value)}
                  className="w-64 px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] focus:border-[var(--accent-primary)] transition-colors text-left"
                />
              </div>

              {/* Work description row */}
              <div className="flex items-center justify-between py-1 relative">
                <span className="text-xs-ui font-medium text-[var(--text-primary)]">What best describes your work?</span>
                <div className="relative">
                  <button
                    onClick={() => setShowWorkDropdown(!showWorkDropdown)}
                    className="w-64 px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-[var(--text-primary)] text-left flex justify-between items-center cursor-pointer"
                  >
                    <span>{workType}</span>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showWorkDropdown && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-64 rounded-xl py-1 z-50 flex flex-col border shadow-xl"
                      style={{
                        background: "var(--surface-raised)",
                        borderColor: "var(--border-subtle)",
                      }}
                    >
                      {["Developer", "Designer", "Writer", "Student", "Researcher", "Other"].map(item => (
                        <button
                          key={item}
                          onClick={() => handleSaveWorkType(item)}
                          className="px-3.5 py-2 text-xs-ui text-left hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-[var(--text-primary)]"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions row */}
              <div className="flex flex-col py-1">
                <span className="text-xs-ui font-medium text-[var(--text-primary)] mb-0.5">Instructions for Cogito</span>
                <span className="text-[11px] text-[var(--text-secondary)] opacity-75">
                  Cogito will keep these in mind across chats. <a href="#" className="underline hover:text-[var(--text-primary)]">Learn more</a>
                </span>
                <textarea
                  value={instructions}
                  onChange={(e) => handleSaveInstructions(e.target.value)}
                  placeholder="e.g. keep explanations brief and to the point"
                  className="w-full rounded-xl bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] px-4 py-3 text-xs-ui text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] mt-2.5 resize-none h-24 transition-colors"
                />
              </div>

              {/* Preferences Header */}
              <div className="mt-2">
                <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">Preferences</h2>
                <div className="w-full border-b border-[var(--border-subtle)] my-2" />
              </div>

              {/* Appearance row */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs-ui font-medium text-[var(--text-primary)]">Appearance</span>
                <div
                  className="flex rounded-xl p-0.5 border"
                  style={{
                    background: "rgba(0,0,0,0.15)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <button
                    onClick={() => handleAppearanceChange("system")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      appearance === "system"
                        ? "bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <MonitorIcon size={13} />
                  </button>
                  <button
                    onClick={() => handleAppearanceChange("light")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      appearance === "light"
                        ? "bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <SunIcon size={13} />
                  </button>
                  <button
                    onClick={() => handleAppearanceChange("dark")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      appearance === "dark"
                        ? "bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <MoonIcon size={13} />
                  </button>
                </div>
              </div>

              {/* Chat font row */}
              <div className="flex items-center justify-between py-1 relative">
                <span className="text-xs-ui font-medium text-[var(--text-primary)]">Chat font</span>
                <div className="relative">
                  <button
                    onClick={() => setShowFontDropdown(!showFontDropdown)}
                    className="w-64 px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-[var(--text-primary)] text-left flex justify-between items-center cursor-pointer"
                  >
                    <span>{chatFont}</span>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showFontDropdown && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-64 rounded-xl py-1 z-50 flex flex-col border shadow-xl"
                      style={{
                        background: "var(--surface-raised)",
                        borderColor: "var(--border-subtle)",
                      }}
                    >
                      {["Cogito Serif", "System Sans-Serif", "Mono"].map(item => (
                        <button
                          key={item}
                          onClick={() => {
                            setFontTheme(item);
                            setShowFontDropdown(false);
                          }}
                          className="px-3.5 py-2 text-xs-ui text-left hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-[var(--text-primary)]"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cogito TTS Header */}
              <div className="mt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
                    Cogito TTS
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(201,96,63,0.15)] text-[var(--accent-primary)] font-semibold uppercase tracking-wider">Fast Neural</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const currentVoice = availableVoices.find(v => v.id === voiceSettings.voiceId) || availableVoices[0];
                      const testText = currentVoice?.previewText || "Cogito online. Distant transmission established.";
                      if (isPlaying && activeId === "settings-preview") {
                        stopVoice();
                      } else {
                        playVoice(testText, "settings-preview");
                      }
                    }}
                    disabled={isGenerating && activeId !== "settings-preview"}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all border ${
                      isPlaying && activeId === "settings-preview"
                        ? "text-[var(--accent-primary)] bg-[rgba(201,96,63,0.12)] border-[var(--accent-primary)]"
                        : isGenerating && activeId === "settings-preview"
                        ? "text-[var(--accent-primary)] bg-[rgba(201,96,63,0.08)] border-[var(--accent-primary)] animate-pulse"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:bg-[rgba(255,255,255,0.04)]"
                    }`}
                  >
                    {isGenerating && activeId === "settings-preview" ? (
                      <>
                        <svg className="animate-spin" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                        <span>Synthesizing…</span>
                      </>
                    ) : isPlaying && activeId === "settings-preview" ? (
                      <>
                        <SpeakerStopIcon size={13} />
                        <span>Stop Preview</span>
                      </>
                    ) : (
                      <>
                        <SpeakerWaveIcon size={13} />
                        <span>Test Voice</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="w-full border-b border-[var(--border-subtle)] my-2" />
              </div>

              {/* Voice Engine row */}
              <div className="flex items-center justify-between py-1">
                <div className="flex flex-col">
                  <span className="text-xs-ui font-medium text-[var(--text-primary)]">Voice engine</span>
                  <span className="text-[11px] text-[var(--text-secondary)] opacity-75 mt-0.5">
                    {voiceSettings.engine === "neural" ? "Kokoro 82M server neural model" : "Instant native speech (0ms latency)"}
                  </span>
                </div>
                <div
                  className="flex rounded-xl p-0.5 border"
                  style={{
                    background: "rgba(0,0,0,0.15)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  {[
                    { label: "Instant (0ms)", value: "instant" },
                    { label: "Kokoro Neural", value: "neural" },
                  ].map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => updateVoiceSettings({ engine: item.value as "instant" | "neural" })}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        (voiceSettings.engine || "instant") === item.value
                          ? "bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)] shadow-sm font-bold"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Persona row */}
              <div className="flex items-center justify-between py-1 relative">
                <div className="flex flex-col">
                  <span className="text-xs-ui font-medium text-[var(--text-primary)]">Voice persona</span>
                  <span className="text-[11px] text-[var(--text-secondary)] opacity-75 mt-0.5">
                    {availableVoices.find(v => v.id === voiceSettings.voiceId)?.description || "Neural voice"}
                  </span>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowVoiceDropdown(!showVoiceDropdown)}
                    className="w-64 px-3 py-1.5 rounded-lg text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] hover:bg-[rgba(255,255,255,0.02)] transition-colors text-[var(--text-primary)] text-left flex justify-between items-center cursor-pointer"
                  >
                    <span>{availableVoices.find(v => v.id === voiceSettings.voiceId)?.name || voiceSettings.voiceId}</span>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showVoiceDropdown && (
                    <div
                      className="absolute right-0 top-full mt-1.5 w-72 max-h-60 overflow-y-auto rounded-xl py-1 z-50 flex flex-col border shadow-xl"
                      style={{
                        background: "var(--surface-raised)",
                        borderColor: "var(--border-subtle)",
                      }}
                    >
                      {availableVoices.map(v => (
                        <button
                          key={v.id}
                          onClick={() => {
                            updateVoiceSettings({ voiceId: v.id });
                            setShowVoiceDropdown(false);
                          }}
                          className={`px-3.5 py-2 text-xs-ui text-left hover:bg-[rgba(255,255,255,0.04)] cursor-pointer flex flex-col gap-0.5 transition-colors ${
                            voiceSettings.voiceId === v.id ? "bg-[rgba(201,96,63,0.1)] text-[var(--accent-primary)] font-semibold" : "text-[var(--text-primary)]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{v.name}</span>
                            {v.accent && <span className="text-[10px] opacity-60 font-mono">{v.accent}</span>}
                          </div>
                          <span className="text-[10px] text-[var(--text-secondary)] opacity-80 font-normal line-clamp-1">
                            {v.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Transmission FX toggle */}
              <div className="flex items-start justify-between py-1 gap-4">
                <div className="flex flex-col flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs-ui font-medium text-[var(--text-primary)]">Transmission FX</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[rgba(201,96,63,0.15)] text-[var(--accent-primary)] font-semibold">COGITO</span>
                  </div>
                  <span className="text-[11px] text-[var(--text-secondary)] opacity-75 mt-0.5 leading-normal">
                    Applies vintage broadcast resonance, saturation, and subtle static bed.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateVoiceSettings({ fxEnabled: !voiceSettings.fxEnabled })}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0 mt-0.5 ${
                    voiceSettings.fxEnabled ? "bg-[var(--accent-primary)]" : "bg-neutral-600"
                  }`}
                  aria-label="Toggle Transmission FX"
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      voiceSettings.fxEnabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Speed selector */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xs-ui font-medium text-[var(--text-primary)]">Speed</span>
                <div
                  className="flex rounded-xl p-0.5 border"
                  style={{
                    background: "rgba(0,0,0,0.15)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  {[
                    { label: "0.75x", value: 0.75 },
                    { label: "0.85x", value: 0.85 },
                    { label: "1.0x", value: 1.0 },
                    { label: "1.15x", value: 1.15 },
                  ].map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => updateVoiceSettings({ speed: item.value })}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                        voiceSettings.speed === item.value
                          ? "bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)] shadow-sm font-bold"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Read aloud toggle */}
              <div className="flex items-start justify-between py-1 gap-4">
                <div className="flex flex-col flex-1">
                  <span className="text-xs-ui font-medium text-[var(--text-primary)]">Read aloud</span>
                  <span className="text-[11px] text-[var(--text-secondary)] opacity-75 mt-0.5 leading-normal">
                    Automatically speak new responses.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => updateVoiceSettings({ autoPlay: !voiceSettings.autoPlay })}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0 mt-0.5 ${
                    voiceSettings.autoPlay ? "bg-[var(--accent-primary)]" : "bg-neutral-600"
                  }`}
                  aria-label="Toggle Read aloud"
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      voiceSettings.autoPlay ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

            </div>
          ) : activeTab === "privacy" ? (
            <div className="flex flex-col gap-6 max-w-2xl mt-2 pr-2">
              {/* Header */}
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">Privacy</h2>
                <p className="text-xs-ui text-[var(--text-secondary)] leading-relaxed">
                  Cogito believes in transparent data practices. Learn how your information is protected when using Cogito, and visit our local Privacy Policy for more details.
                </p>
                <div className="w-full border-b border-[var(--border-subtle)] my-3" />
              </div>

              {/* Data usage list */}
              <div className="flex flex-col gap-1.5">
                <button className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.02)] border border-[var(--border-subtle)] transition-colors cursor-pointer text-xs-ui text-[var(--text-primary)] font-medium text-left">
                  <span>How we protect your data</span>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.02)] border border-[var(--border-subtle)] transition-colors cursor-pointer text-xs-ui text-[var(--text-primary)] font-medium text-left">
                  <span>How we use your data</span>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>

              {/* Preferences Header */}
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">Preferences</h2>
                <div className="w-full border-b border-[var(--border-subtle)] my-2" />
              </div>

              {/* Location metadata toggle */}
              <div className="flex items-start justify-between py-1 gap-4">
                <div className="flex flex-col flex-1">
                  <span className="text-xs-ui font-medium text-[var(--text-primary)]">Location metadata</span>
                  <span className="text-[11px] text-[var(--text-secondary)] opacity-75 mt-0.5 leading-normal">
                    Allow Cogito to use coarse location metadata (city/region) to improve product experiences. <a href="#" className="underline hover:text-[var(--text-primary)]">Learn more</a>
                  </span>
                </div>
                <button
                  onClick={() => handleLocationToggle(!locationEnabled)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0 mt-0.5 ${
                    locationEnabled ? "bg-[#1062c3]" : "bg-neutral-600"
                  }`}
                  aria-label="Toggle location metadata"
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      locationEnabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* AI training toggle */}
              <div className="flex items-start justify-between py-1 gap-4">
                <div className="flex flex-col flex-1">
                  <span className="text-xs-ui font-medium text-[var(--text-primary)]">Help improve our AI models</span>
                  <span className="text-[11px] text-[var(--text-secondary)] opacity-75 mt-0.5 leading-normal">
                    Allow the use of your chats and coding sessions to train and improve Cogito local AI models. <a href="#" className="underline hover:text-[var(--text-primary)]">Learn more</a>
                  </span>
                </div>
                <button
                  onClick={() => handleTrainToggle(!trainEnabled)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0 mt-0.5 ${
                    trainEnabled ? "bg-[#1062c3]" : "bg-neutral-600"
                  }`}
                  aria-label="Toggle AI training"
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      trainEnabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Your data Header */}
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">Your data</h2>
                <div className="w-full border-b border-[var(--border-subtle)] my-2" />
              </div>

              {/* Data actions list */}
              <div className="flex flex-col gap-1.5">
                <button className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.02)] border border-[var(--border-subtle)] transition-colors cursor-pointer text-xs-ui text-[var(--text-primary)] font-medium text-left">
                  <span>Export data</span>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.02)] border border-[var(--border-subtle)] transition-colors cursor-pointer text-xs-ui text-[var(--text-primary)] font-medium text-left">
                  <span>Shared chats</span>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button className="flex items-center justify-between w-full p-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.02)] border border-[var(--border-subtle)] transition-colors cursor-pointer text-xs-ui text-[var(--text-primary)] font-medium text-left">
                  <span>Memory preferences</span>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          ) : activeTab === "account" ? (
            <div className="flex flex-col gap-6 max-w-2xl mt-2 pr-2">
              {/* Header */}
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)] mb-1">Account</h2>
                <p className="text-xs-ui text-[var(--text-secondary)] leading-relaxed">
                  Manage your personal profile and account credentials.
                </p>
                <div className="w-full border-b border-[var(--border-subtle)] my-3" />
              </div>

              {accountStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    accountStatus.type === "success"
                      ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                      : "bg-red-950/40 border-red-800/60 text-red-300"
                  }`}
                >
                  <span>{accountStatus.type === "success" ? "✓" : "⚠️"}</span>
                  <span>{accountStatus.message}</span>
                </div>
              )}

              {user ? (
                <>
                  {/* Profile Card */}
                  <div
                    className="p-4 rounded-xl border flex items-center gap-4"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-md flex-shrink-0"
                      style={{ backgroundColor: accountAvatarColor || user.avatarColor || "var(--accent-primary)" }}
                    >
                      {(accountDisplayName || user.displayName || user.username).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {user.displayName}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] font-mono truncate">
                        @{user.username}
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)]">
                          ID: {user.id.slice(0, 8)}...
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Active
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Edit Profile Form */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={accountDisplayName}
                        onChange={(e) => setAccountDisplayName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] focus:border-[var(--accent-primary)] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
                        Avatar Color
                      </label>
                      <div className="flex items-center gap-2 pt-0.5">
                        {AVATAR_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setAccountAvatarColor(c)}
                            className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                            style={{
                              backgroundColor: c,
                              boxShadow: accountAvatarColor === c ? "0 0 0 2px var(--surface-app), 0 0 0 4px " + c : "none",
                            }}
                          >
                            {accountAvatarColor === c && <CheckIcon size={12} className="text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5 text-[var(--text-secondary)]">
                        Change Password (leave blank to keep current)
                      </label>
                      <input
                        type="password"
                        placeholder="New password (min. 3 characters)"
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl text-xs-ui bg-[rgba(0,0,0,0.15)] border border-[var(--border-subtle)] outline-none text-[var(--text-primary)] focus:border-[var(--accent-primary)] transition-all"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isUpdatingAccount}
                      onClick={async () => {
                        setIsUpdatingAccount(true);
                        setAccountStatus(null);
                        const result = await updateProfile({
                          displayName: accountDisplayName,
                          avatarColor: accountAvatarColor,
                          password: accountPassword || undefined,
                        });
                        setIsUpdatingAccount(false);
                        if (result.success) {
                          setAccountStatus({ type: "success", message: "Account profile updated successfully" });
                          setAccountPassword("");
                          setTimeout(() => setAccountStatus(null), 4000);
                        } else {
                          setAccountStatus({ type: "error", message: result.error || "Failed to update profile" });
                        }
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-medium bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {isUpdatingAccount ? "Saving changes..." : "Save Profile Changes"}
                    </button>
                  </div>

                  {/* Account Switch & Logout */}
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        openAuthModal("switch");
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-medium border border-[var(--border-subtle)] hover:bg-[var(--bg-sidebar-hover)] text-[var(--text-primary)] transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <UserPlusIcon size={14} />
                      <span>Switch Account</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        setAccountStatus({ type: "success", message: "Signed out successfully" });
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-950/30 border border-red-900/40 transition-all cursor-pointer"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              ) : (
                /* Guest State */
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 rounded-xl border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.01)]">
                  <div className="w-12 h-12 rounded-full bg-[rgba(201,96,63,0.15)] flex items-center justify-center text-[var(--accent-primary)]">
                    <UserPlusIcon size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Guest Mode Active</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
                      Sign in or create a free account to save your chat history and preferences.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      openAuthModal("login");
                    }}
                    className="px-5 py-2.5 rounded-xl text-xs font-medium bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white transition-all cursor-pointer shadow-md"
                  >
                    Sign In / Create Account
                  </button>
                </div>
              )}
            </div>
          ) : activeTab === "skills" ? (
            <div className="flex flex-col gap-4 max-w-3xl mt-1 pr-2 h-full overflow-y-auto">

              {/* Action feedback banner */}
              {skillActionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between border animate-fade-in ${
                    skillActionMessage.type === "success"
                      ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
                      : "bg-red-950/30 border-red-800/50 text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{skillActionMessage.type === "success" ? "✓" : "⚠️"}</span>
                    <span>{skillActionMessage.message}</span>
                  </div>
                  <button onClick={() => setSkillActionMessage(null)} className="opacity-70 hover:opacity-100 cursor-pointer">✕</button>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  VIEW 1: IN-PLACE SKILL DETAIL / INSPECT VIEW
                  ══════════════════════════════════════════════════════════════ */}
              {skillsViewMode === "detail" && selectedSkill ? (
                <div className="flex flex-col gap-4 animate-fade-in">
                  {/* Back Navigation Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.08)]">
                    <button
                      type="button"
                      onClick={() => setSkillsViewMode("list")}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      <span>Back to Skills</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {selectedSkill.isInstalled ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditSkill({
                                isNew: false,
                                name: selectedSkill.name,
                                description: selectedSkill.description,
                                license: selectedSkill.license || "",
                                compatibility: selectedSkill.compatibility || "",
                                allowedTools: (selectedSkill.allowedTools || []).join(", "),
                                instructions: selectedSkill.instructions,
                              });
                              setEditSkillError("");
                              setSkillsViewMode("edit");
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-white border border-[rgba(255,255,255,0.08)] transition-all cursor-pointer"
                          >
                            <PencilIcon size={12} />
                            <span>Edit Skill</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSkill(selectedSkill.name)}
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer"
                            title="Delete skill"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </>
                      ) : selectedSkill.curatedItem ? (
                        <button
                          type="button"
                          onClick={() => handleInstallCurated(selectedSkill.curatedItem!)}
                          disabled={installingCuratedId === selectedSkill.curatedItem.id}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          {installingCuratedId === selectedSkill.curatedItem.id ? (
                            <>
                              <RefreshIcon size={12} className="animate-spin" />
                              <span>Installing...</span>
                            </>
                          ) : (
                            <>
                              <PlusIcon size={12} />
                              <span>Install Skill</span>
                            </>
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Header Title */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg font-bold text-white font-mono">
                        /{selectedSkill.name}
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-[rgba(255,255,255,0.06)] text-neutral-300 border border-[rgba(255,255,255,0.08)]">
                        SKILL.MD
                      </span>
                      {selectedSkill.source && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)]">
                          {selectedSkill.source}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {selectedSkill.description}
                    </p>
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-xs">
                    <div>
                      <span className="text-[var(--text-secondary)] text-[11px] block">License</span>
                      <span className="text-white font-mono mt-0.5 block">{selectedSkill.license || "None specified"}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)] text-[11px] block">Compatibility</span>
                      <span className="text-white mt-0.5 block">{selectedSkill.compatibility || "Universal"}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-secondary)] text-[11px] block">Allowed Tools</span>
                      <span className="text-white font-mono mt-0.5 block">
                        {selectedSkill.allowedTools && selectedSkill.allowedTools.length > 0
                          ? selectedSkill.allowedTools.join(", ")
                          : "Any active tool"}
                      </span>
                    </div>
                  </div>

                  {/* Tabs: Formatted Instructions vs Raw SKILL.md */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex rounded-lg p-0.5 border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)]">
                      <button
                        type="button"
                        onClick={() => setDetailTab("rendered")}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          detailTab === "rendered"
                            ? "bg-white text-neutral-900 font-semibold shadow-xs"
                            : "text-[var(--text-secondary)] hover:text-white"
                        }`}
                      >
                        Formatted Instructions
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailTab("raw")}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          detailTab === "raw"
                            ? "bg-white text-neutral-900 font-semibold shadow-xs"
                            : "text-[var(--text-secondary)] hover:text-white"
                        }`}
                      >
                        Raw SKILL.md
                      </button>
                    </div>

                    {detailTab === "raw" && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedSkill.content);
                          setCopiedRaw(true);
                          setTimeout(() => setCopiedRaw(false), 2000);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.1)] text-neutral-200 border border-[rgba(255,255,255,0.08)] transition-all cursor-pointer"
                      >
                        {copiedRaw ? (
                          <>
                            <CheckIcon size={12} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <span>Copy Raw</span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Body Content */}
                  {detailTab === "rendered" ? (
                    <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-xs text-neutral-200 leading-relaxed overflow-x-auto">
                      <MarkdownRenderer content={selectedSkill.instructions || selectedSkill.content} />
                    </div>
                  ) : (
                    <pre className="p-4 rounded-xl bg-[rgba(0,0,0,0.35)] border border-[rgba(255,255,255,0.06)] text-xs font-mono text-neutral-200 whitespace-pre-wrap overflow-x-auto leading-relaxed select-text">
                      {selectedSkill.content}
                    </pre>
                  )}
                </div>
              ) : skillsViewMode === "edit" && editSkill ? (
                /* ══════════════════════════════════════════════════════════════
                   VIEW 2: IN-PLACE SKILL EDITOR / CREATOR
                   ══════════════════════════════════════════════════════════════ */
                <div className="flex flex-col gap-4 animate-fade-in">
                  {/* Back Navigation Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.08)]">
                    <button
                      type="button"
                      onClick={() => setSkillsViewMode("list")}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      <span>Back to Skills</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSkillsViewMode("list")}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditSkill}
                        disabled={isSavingSkill}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {isSavingSkill ? "Saving..." : "Save Skill"}
                      </button>
                    </div>
                  </div>

                  <h2 className="text-base font-semibold text-white">
                    {editSkill.isNew ? "Create Custom Skill" : `Edit Skill: /${editSkill.name}`}
                  </h2>

                  {editSkillError && (
                    <div className="p-3 rounded-xl text-xs bg-red-950/40 border border-red-800/50 text-red-300">
                      ⚠️ {editSkillError}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                          Skill Name (lowercase alphanumeric & hyphens)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. database-architect"
                          value={editSkill.name}
                          disabled={!editSkill.isNew}
                          onChange={(e) => setEditSkill({ ...editSkill, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono transition-all disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                          License (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="MIT"
                          value={editSkill.license}
                          onChange={(e) => setEditSkill({ ...editSkill, license: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                        Description (Used by the model for semantic matching & progressive discovery)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Comprehensive description of what this skill does and when the agent should trigger it..."
                        value={editSkill.description}
                        onChange={(e) => setEditSkill({ ...editSkill, description: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 resize-none transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                          Allowed Tools (comma-separated, optional)
                        </label>
                        <input
                          type="text"
                          placeholder="search_web, run_python"
                          value={editSkill.allowedTools}
                          onChange={(e) => setEditSkill({ ...editSkill, allowedTools: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                          Compatibility Requirements (optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Python 3.10+, Docker"
                          value={editSkill.compatibility}
                          onChange={(e) => setEditSkill({ ...editSkill, compatibility: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                        Instructions & Methodology (Markdown Body)
                      </label>
                      <textarea
                        rows={10}
                        placeholder="# Instructions\n\n1. Detail the exact multi-step procedure..."
                        value={editSkill.instructions}
                        onChange={(e) => setEditSkill({ ...editSkill, instructions: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono resize-y min-h-[160px] transition-all"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* ══════════════════════════════════════════════════════════════
                   VIEW 3: MAIN SKILLS LIST & CURATED CATALOG
                   ══════════════════════════════════════════════════════════════ */
                <div className="flex flex-col gap-4 animate-fade-in">
                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[rgba(255,255,255,0.08)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-white">Claude & Agent Skills</h2>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-[rgba(255,255,255,0.06)] text-neutral-300 border border-[rgba(255,255,255,0.08)]">
                          SKILL.MD
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Modular, portable packages following the open Agent Skills standard.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowDownloadPanel((prev) => !prev)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          showDownloadPanel
                            ? "bg-[rgba(255,255,255,0.12)] text-white border-[rgba(255,255,255,0.2)]"
                            : "bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.09)] text-neutral-200 border-[rgba(255,255,255,0.08)]"
                        }`}
                      >
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Download URL / GitHub</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditSkill({
                            isNew: true,
                            name: "",
                            description: "",
                            license: "MIT",
                            compatibility: "",
                            allowedTools: "",
                            instructions: "# Custom Skill Instructions\n\n1. First step...\n2. Second step...\n",
                          });
                          setEditSkillError("");
                          setSkillsViewMode("edit");
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer shadow-sm"
                      >
                        <PlusIcon size={13} />
                        <span>New Skill</span>
                      </button>

                      <button
                        type="button"
                        onClick={fetchSkillsList}
                        disabled={skillsLoading}
                        className="p-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer disabled:opacity-50"
                        title="Refresh skills"
                      >
                        <RefreshIcon size={14} className={skillsLoading ? "animate-spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {/* ── Inline Expandable Download Panel ── */}
                  {showDownloadPanel && (
                    <div className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] p-4 flex flex-col gap-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white">
                          Download Skill from GitHub or URL
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowDownloadPanel(false)}
                          className="text-[var(--text-secondary)] hover:text-white text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        Paste a public GitHub repo link, directory URL, or raw <code className="text-neutral-200">SKILL.md</code> link to install.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        <div className="md:col-span-2">
                          <input
                            type="url"
                            placeholder="https://github.com/owner/repo/tree/main/skills/my-skill"
                            value={downloadUrl}
                            onChange={(e) => setDownloadUrl(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono transition-all"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            placeholder="Custom name (optional)"
                            value={downloadCustomName}
                            onChange={(e) => setDownloadCustomName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono transition-all"
                          />
                        </div>
                      </div>

                      {downloadStatus.type === "error" && (
                        <div className="p-2.5 rounded-lg text-xs bg-red-950/40 border border-red-800/50 text-red-300">
                          ⚠️ {downloadStatus.message}
                        </div>
                      )}

                      {downloadStatus.type === "success" && (
                        <div className="p-2.5 rounded-lg text-xs bg-emerald-950/40 border border-emerald-800/50 text-emerald-300">
                          ✓ {downloadStatus.message}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowDownloadPanel(false)}
                          className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadSkill}
                          disabled={downloadStatus.type === "loading" || !downloadUrl.trim()}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                        >
                          {downloadStatus.type === "loading" ? "Downloading..." : "Download & Install"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sub-tabs toggle */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex rounded-xl p-0.5 border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)]">
                      <button
                        type="button"
                        onClick={() => setSkillsSubTab("installed")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          skillsSubTab === "installed"
                            ? "bg-white text-neutral-900 font-semibold shadow-xs"
                            : "text-[var(--text-secondary)] hover:text-white"
                        }`}
                      >
                        <span>Installed Skills</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${skillsSubTab === "installed" ? "bg-neutral-200 text-neutral-900" : "bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)]"}`}>
                          {skillsList.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSkillsSubTab("catalog")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          skillsSubTab === "catalog"
                            ? "bg-white text-neutral-900 font-semibold shadow-xs"
                            : "text-[var(--text-secondary)] hover:text-white"
                        }`}
                      >
                        <SparklesIcon size={12} className={skillsSubTab === "catalog" ? "text-neutral-900" : "text-neutral-400"} />
                        <span>Curated Catalog</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${skillsSubTab === "catalog" ? "bg-neutral-200 text-neutral-900" : "bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)]"}`}>
                          {curatedList.length}
                        </span>
                      </button>
                    </div>

                    {/* Filter Search */}
                    <div className="relative w-56">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-60">
                        <SearchIcon size={13} />
                      </span>
                      <input
                        type="text"
                        placeholder={skillsSubTab === "installed" ? "Search installed..." : "Search catalog..."}
                        value={skillSearch}
                        onChange={(e) => setSkillSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.08)] outline-none text-white placeholder:text-[var(--text-secondary)] placeholder:opacity-50 focus:border-white/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* ── Sub-tab 1: Installed Skills List ── */}
                  {skillsSubTab === "installed" ? (
                    <div className="flex flex-col gap-3 mt-1">
                      {skillsList.length === 0 ? (
                        <div
                          className="rounded-2xl p-8 flex flex-col items-center justify-center gap-3 border border-dashed text-center mt-2 border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.01)]"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.06)] flex items-center justify-center text-white shadow-sm">
                            <SkillsIcon size={24} />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-white">No Skills Installed Yet</h3>
                            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">
                              Install pre-tested skills from the Curated Catalog or download custom skills from GitHub repositories.
                            </p>
                          </div>
                          <div className="flex items-center gap-2.5 mt-2">
                            <button
                              type="button"
                              onClick={() => setSkillsSubTab("catalog")}
                              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer shadow-sm"
                            >
                              Browse Catalog
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowDownloadPanel(true)}
                              className="px-4 py-2 rounded-xl text-xs font-medium border border-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.06)] text-white transition-all cursor-pointer"
                            >
                              Download from URL
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {skillsList
                            .filter((s) => {
                              if (!skillSearch.trim()) return true;
                              const q = skillSearch.toLowerCase();
                              return (
                                s.name.toLowerCase().includes(q) ||
                                s.description.toLowerCase().includes(q) ||
                                (s.license && s.license.toLowerCase().includes(q)) ||
                                (s.source && s.source.toLowerCase().includes(q))
                              );
                            })
                            .map((skill) => (
                              <div
                                key={skill.name}
                                className="rounded-xl border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] p-4 transition-all flex flex-col gap-2.5 bg-[rgba(255,255,255,0.02)]"
                                style={{ opacity: skill.enabled ? 1 : 0.6 }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="font-mono text-sm font-semibold text-white">
                                      /{skill.name}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider bg-[rgba(255,255,255,0.06)] text-neutral-300 border border-[rgba(255,255,255,0.06)]">
                                      {skill.source || "custom"}
                                    </span>
                                    {skill.license && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)] font-mono">
                                        {skill.license}
                                      </span>
                                    )}
                                  </div>

                                  {/* Clean Dark & White Toggle Switch */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-[var(--text-secondary)]">
                                      {skill.enabled ? "Active" : "Disabled"}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSkill(skill.name, !skill.enabled)}
                                      className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0 ${
                                        skill.enabled ? "bg-neutral-400" : "bg-neutral-800"
                                      }`}
                                      aria-label="Toggle skill enabled"
                                    >
                                      <div
                                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                                          skill.enabled ? "translate-x-4" : "translate-x-0"
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </div>

                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                  {skill.description}
                                </p>

                                {/* Tags / Metadata */}
                                <div className="flex items-center justify-between gap-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                                  <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] font-mono truncate">
                                    {skill.allowedTools && skill.allowedTools.length > 0 && (
                                      <span>Tools: {skill.allowedTools.join(", ")}</span>
                                    )}
                                    {skill.compatibility && (
                                      <span className="opacity-80">Req: {skill.compatibility}</span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedSkill({
                                          name: skill.name,
                                          description: skill.description,
                                          content: skill.content,
                                          instructions: skill.instructions,
                                          license: skill.license,
                                          compatibility: skill.compatibility,
                                          allowedTools: skill.allowedTools,
                                          source: skill.source,
                                          sourceUrl: skill.sourceUrl,
                                          isInstalled: true,
                                        });
                                        setDetailTab("rendered");
                                        setSkillsViewMode("detail");
                                      }}
                                      className="px-3 py-1 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-white border border-[rgba(255,255,255,0.08)] transition-all cursor-pointer"
                                    >
                                      View Details
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditSkill({
                                          isNew: false,
                                          name: skill.name,
                                          description: skill.description,
                                          license: skill.license || "",
                                          compatibility: skill.compatibility || "",
                                          allowedTools: (skill.allowedTools || []).join(", "),
                                          instructions: skill.instructions,
                                        });
                                        setEditSkillError("");
                                        setSkillsViewMode("edit");
                                      }}
                                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSkill(skill.name)}
                                      className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer"
                                      title="Delete skill"
                                    >
                                      <TrashIcon size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </>
                      )}
                    </div>
                  ) : (
                    /* ── Sub-tab 2: Curated Catalog ── */
                    <div className="flex flex-col gap-3 mt-1">
                      {/* Category Filter Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        {["All", "Review", "Security", "Productivity", "Architecture", "Development", "Testing", "Prompting"].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCatalogCategory(cat)}
                            className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-all flex-shrink-0 ${
                              catalogCategory === cat
                                ? "bg-white text-neutral-900 font-semibold shadow-xs"
                                : "bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      {/* Curated Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                        {curatedList
                          .filter((item) => {
                            if (catalogCategory !== "All" && item.category !== catalogCategory) {
                              return false;
                            }
                            if (!skillSearch.trim()) return true;
                            const q = skillSearch.toLowerCase();
                            return (
                              item.name.toLowerCase().includes(q) ||
                              item.description.toLowerCase().includes(q) ||
                              item.tags.some((t) => t.toLowerCase().includes(q))
                            );
                          })
                          .map((item) => {
                            const isInstalled = skillsList.some((s) => s.name === item.name);
                            const isInstalling = installingCuratedId === item.id;
                            return (
                              <div
                                key={item.id}
                                className="rounded-xl border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] p-4 flex flex-col justify-between gap-3 bg-[rgba(255,255,255,0.02)] transition-all"
                              >
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-sm font-semibold text-white">
                                      /{item.name}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[rgba(255,255,255,0.06)] text-neutral-300 font-medium">
                                      {item.category}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                                    {item.description}
                                  </p>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                    {item.tags.map((tag) => (
                                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-[rgba(0,0,0,0.3)] text-[var(--text-secondary)] font-mono">
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSkill({
                                        name: item.name,
                                        description: item.description,
                                        content: item.skillMd,
                                        instructions: item.skillMd,
                                        license: "MIT",
                                        source: "Curated Catalog",
                                        isInstalled,
                                        isCurated: true,
                                        curatedItem: item,
                                      });
                                      setDetailTab("rendered");
                                      setSkillsViewMode("detail");
                                    }}
                                    className="text-xs text-[var(--text-secondary)] hover:text-white underline cursor-pointer"
                                  >
                                    View Details
                                  </button>

                                  {isInstalled ? (
                                    <span className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-[rgba(255,255,255,0.06)] text-emerald-400 border border-emerald-800/40">
                                      <CheckIcon size={12} />
                                      <span>Installed</span>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleInstallCurated(item)}
                                      disabled={isInstalling}
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                                    >
                                      {isInstalling ? (
                                        <>
                                          <RefreshIcon size={12} className="animate-spin" />
                                          <span>Installing...</span>
                                        </>
                                      ) : (
                                        <>
                                          <PlusIcon size={12} />
                                          <span>Install Skill</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === "connectors" ? (
            <div className="flex flex-col gap-4 max-w-3xl mt-1 pr-2 h-full overflow-y-auto">

              {/* Action feedback banner */}
              {connectorActionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between border animate-fade-in ${
                    connectorActionMessage.type === "success"
                      ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
                      : "bg-red-950/30 border-red-800/50 text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{connectorActionMessage.type === "success" ? "✓" : "⚠️"}</span>
                    <span>{connectorActionMessage.message}</span>
                  </div>
                  <button onClick={() => setConnectorActionMessage(null)} className="opacity-70 hover:opacity-100 cursor-pointer">✕</button>
                </div>
              )}

              {/* ══════════════════════════════════════════════════════════════
                  VIEW 1: CONNECTOR DETAIL / TOOL INSPECTOR VIEW
                  ══════════════════════════════════════════════════════════════ */}
              {connectorsViewMode === "detail" && selectedConnector ? (
                <div className="flex flex-col gap-4 animate-fade-in">
                  {/* Back Navigation Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.08)]">
                    <button
                      type="button"
                      onClick={() => setConnectorsViewMode("list")}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      <span>Back to Connectors</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestConnector(selectedConnector.id)}
                        disabled={testingConnectorId === selectedConnector.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-white border border-[rgba(255,255,255,0.08)] transition-all cursor-pointer disabled:opacity-50"
                      >
                        {testingConnectorId === selectedConnector.id ? (
                          <>
                            <RefreshIcon size={12} className="animate-spin" />
                            <span>Testing...</span>
                          </>
                        ) : (
                          <>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                            </svg>
                            <span>Test Connection</span>
                          </>
                        )}
                      </button>

                      {!selectedConnector.id.startsWith("builtin-") && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditConnector({
                                isNew: false,
                                id: selectedConnector.id,
                                name: selectedConnector.name,
                                description: selectedConnector.description,
                                type: selectedConnector.type,
                                category: selectedConnector.category,
                                command: selectedConnector.config.command || "",
                                args: (selectedConnector.config.args || []).join(" "),
                                env: selectedConnector.config.env ? JSON.stringify(selectedConnector.config.env, null, 2) : "",
                                url: selectedConnector.config.url || "",
                                headers: selectedConnector.config.headers ? JSON.stringify(selectedConnector.config.headers, null, 2) : "",
                                timeoutMs: selectedConnector.config.timeoutMs || 30000,
                              });
                              setEditConnectorError("");
                              setConnectorsViewMode("edit");
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-white border border-[rgba(255,255,255,0.08)] transition-all cursor-pointer"
                          >
                            <PencilIcon size={12} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteConnector(selectedConnector.id)}
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer"
                            title="Delete connector"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Header Title */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-lg font-bold text-white">
                        {selectedConnector.name}
                      </h2>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium uppercase tracking-wider bg-[rgba(255,255,255,0.06)] text-neutral-300 border border-[rgba(255,255,255,0.08)]">
                        {selectedConnector.type}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full capitalize bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)]">
                        {selectedConnector.category}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          selectedConnector.status === "ready" || selectedConnector.status === "connected"
                            ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/40"
                            : selectedConnector.status === "error"
                            ? "bg-red-950/40 text-red-300 border border-red-800/40"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        ● {selectedConnector.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {selectedConnector.description}
                    </p>
                  </div>

                  {/* Test result status if available */}
                  {connectorTestResults[selectedConnector.id] && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
                        connectorTestResults[selectedConnector.id].success
                          ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
                          : "bg-red-950/30 border-red-800/50 text-red-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{connectorTestResults[selectedConnector.id].success ? "✓" : "⚠️"}</span>
                        <span>{connectorTestResults[selectedConnector.id].message}</span>
                      </div>
                      {connectorTestResults[selectedConnector.id].latencyMs !== undefined && (
                        <span className="font-mono text-[10px] opacity-80">
                          {connectorTestResults[selectedConnector.id].latencyMs}ms
                        </span>
                      )}
                    </div>
                  )}

                  {/* Configuration Summary */}
                  {Object.keys(selectedConnector.config).length > 0 && (
                    <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-xs">
                      <span className="text-xs font-semibold text-white">Connector Configuration</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {selectedConnector.config.command && (
                          <div>
                            <span className="text-[var(--text-secondary)] text-[11px] block">Command</span>
                            <span className="text-white font-mono mt-0.5 block">{selectedConnector.config.command}</span>
                          </div>
                        )}
                        {selectedConnector.config.args && selectedConnector.config.args.length > 0 && (
                          <div>
                            <span className="text-[var(--text-secondary)] text-[11px] block">Arguments</span>
                            <span className="text-white font-mono mt-0.5 block">{selectedConnector.config.args.join(" ")}</span>
                          </div>
                        )}
                        {selectedConnector.config.url && (
                          <div>
                            <span className="text-[var(--text-secondary)] text-[11px] block">URL</span>
                            <span className="text-white font-mono mt-0.5 block truncate">{selectedConnector.config.url}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-[var(--text-secondary)] text-[11px] block">Timeout</span>
                          <span className="text-white font-mono mt-0.5 block">{selectedConnector.config.timeoutMs || 30000}ms</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tools List Provided by this Connector */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">
                        Exposed AI Agent Tools ({selectedConnector.tools.length})
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        These tools are automatically registered and available during chat
                      </span>
                    </div>

                    {selectedConnector.tools.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] text-center text-xs text-[var(--text-secondary)]">
                        No tools currently discovered. Click &quot;Test Connection&quot; above to discover live tools from the server.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {selectedConnector.tools.map((tool) => (
                          <div
                            key={tool.name}
                            className="p-3.5 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] flex flex-col gap-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-white bg-[rgba(255,255,255,0.06)] px-2 py-0.5 rounded">
                                &lt;action name=&quot;{tool.name}&quot;&gt;
                              </span>
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                              {tool.description}
                            </p>
                            {tool.usage && (
                              <pre className="mt-1 p-2 rounded-lg bg-[rgba(0,0,0,0.3)] text-[11px] font-mono text-neutral-300 overflow-x-auto">
                                {tool.usage}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : connectorsViewMode === "edit" && editConnector ? (
                /* ══════════════════════════════════════════════════════════════
                   VIEW 2: CONNECTOR EDITOR / CREATOR VIEW
                   ══════════════════════════════════════════════════════════════ */
                <div className="flex flex-col gap-4 animate-fade-in">
                  {/* Back Navigation Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-[rgba(255,255,255,0.08)]">
                    <button
                      type="button"
                      onClick={() => setConnectorsViewMode("list")}
                      className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white transition-colors cursor-pointer"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                      <span>Back to Connectors</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConnectorsViewMode("list")}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditConnector}
                        disabled={isSavingConnector}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {isSavingConnector ? "Saving..." : "Save Connector"}
                      </button>
                    </div>
                  </div>

                  <h2 className="text-base font-semibold text-white">
                    {editConnector.isNew ? "Add Connector / MCP Server" : `Edit Connector: ${editConnector.name}`}
                  </h2>

                  {editConnectorError && (
                    <div className="p-3 rounded-xl text-xs bg-red-950/40 border border-red-800/50 text-red-300">
                      ⚠️ {editConnectorError}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                          Connector Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. My PostgreSQL Database"
                          value={editConnector.name}
                          onChange={(e) => setEditConnector({ ...editConnector, name: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                          Connector Type
                        </label>
                        <select
                          value={editConnector.type}
                          onChange={(e) => setEditConnector({ ...editConnector, type: e.target.value as any })}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 transition-all cursor-pointer"
                        >
                          <option value="mcp_stdio">Model Context Protocol (Stdio Process)</option>
                          <option value="mcp_sse">Model Context Protocol (HTTP / SSE)</option>
                          <option value="custom_http">Custom REST API Webhook</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                        Description
                      </label>
                      <input
                        type="text"
                        placeholder="Purpose and capabilities of this connector..."
                        value={editConnector.description}
                        onChange={(e) => setEditConnector({ ...editConnector, description: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 transition-all"
                      />
                    </div>

                    {/* Stdio Specific Fields */}
                    {editConnector.type === "mcp_stdio" && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                              Command Executable
                            </label>
                            <input
                              type="text"
                              placeholder="npx, python, uvx, node"
                              value={editConnector.command}
                              onChange={(e) => setEditConnector({ ...editConnector, command: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                              Command Arguments
                            </label>
                            <input
                              type="text"
                              placeholder="-y @modelcontextprotocol/server-filesystem ./data"
                              value={editConnector.args}
                              onChange={(e) => setEditConnector({ ...editConnector, args: e.target.value })}
                              className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono transition-all"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                            Environment Variables (KEY=VALUE or JSON format, optional)
                          </label>
                          <textarea
                            rows={3}
                            placeholder="GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...\nNODE_ENV=production"
                            value={editConnector.env}
                            onChange={(e) => setEditConnector({ ...editConnector, env: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono resize-none transition-all"
                          />
                        </div>
                      </>
                    )}

                    {/* HTTP / SSE Specific Fields */}
                    {(editConnector.type === "mcp_sse" || editConnector.type === "custom_http") && (
                      <>
                        <div>
                          <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                            Endpoint URL
                          </label>
                          <input
                            type="url"
                            placeholder="http://localhost:8000/sse or https://mcp.company.com"
                            value={editConnector.url}
                            onChange={(e) => setEditConnector({ ...editConnector, url: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium mb-1 text-[var(--text-secondary)]">
                            Custom HTTP Headers (JSON format, optional)
                          </label>
                          <textarea
                            rows={3}
                            placeholder='{\n  "Authorization": "Bearer token..."\n}'
                            value={editConnector.headers}
                            onChange={(e) => setEditConnector({ ...editConnector, headers: e.target.value })}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] outline-none text-white focus:border-white/40 font-mono resize-none transition-all"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                /* ══════════════════════════════════════════════════════════════
                   VIEW 3: MAIN CONNECTORS LIST & PRESETS CATALOG
                   ══════════════════════════════════════════════════════════════ */
                <div className="flex flex-col gap-4 animate-fade-in">
                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[rgba(255,255,255,0.08)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-white">Connectors & MCP Integrations</h2>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-[rgba(255,255,255,0.06)] text-neutral-300 border border-[rgba(255,255,255,0.08)]">
                          MCP / TOOLS
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Integrate external databases, live web data, APIs, and Model Context Protocol servers.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditConnector({
                            isNew: true,
                            id: `custom-${Date.now()}`,
                            name: "",
                            description: "",
                            type: "mcp_stdio",
                            category: "mcp",
                            command: "npx",
                            args: "-y @modelcontextprotocol/server-filesystem ./data",
                            env: "",
                            url: "",
                            headers: "",
                            timeoutMs: 30000,
                          });
                          setEditConnectorError("");
                          setConnectorsViewMode("edit");
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer shadow-sm"
                      >
                        <PlusIcon size={13} />
                        <span>Add Connector</span>
                      </button>

                      <button
                        type="button"
                        onClick={fetchConnectorsList}
                        disabled={connectorsLoading}
                        className="p-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer disabled:opacity-50"
                        title="Refresh connectors"
                      >
                        <RefreshIcon size={14} className={connectorsLoading ? "animate-spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {/* Sub-tabs toggle */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex rounded-xl p-0.5 border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.2)]">
                      <button
                        type="button"
                        onClick={() => setConnectorsSubTab("active")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          connectorsSubTab === "active"
                            ? "bg-white text-neutral-900 font-semibold shadow-xs"
                            : "text-[var(--text-secondary)] hover:text-white"
                        }`}
                      >
                        <span>Configured</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${connectorsSubTab === "active" ? "bg-neutral-200 text-neutral-900" : "bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)]"}`}>
                          {connectorsList.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConnectorsSubTab("catalog")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                          connectorsSubTab === "catalog"
                            ? "bg-white text-neutral-900 font-semibold shadow-xs"
                            : "text-[var(--text-secondary)] hover:text-white"
                        }`}
                      >
                        <SparklesIcon size={12} className={connectorsSubTab === "catalog" ? "text-neutral-900" : "text-neutral-400"} />
                        <span>MCP Catalog & Presets</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${connectorsSubTab === "catalog" ? "bg-neutral-200 text-neutral-900" : "bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)]"}`}>
                          {connectorPresets.length}
                        </span>
                      </button>
                    </div>

                    {/* Filter Search */}
                    <div className="relative w-56">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-60">
                        <SearchIcon size={13} />
                      </span>
                      <input
                        type="text"
                        placeholder="Search connectors..."
                        value={connectorSearch}
                        onChange={(e) => setConnectorSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.08)] outline-none text-white placeholder:text-[var(--text-secondary)] placeholder:opacity-50 focus:border-white/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* ── Sub-tab 1: Configured Connectors List ── */}
                  {connectorsSubTab === "active" ? (
                    <div className="flex flex-col gap-3 mt-1">
                      {connectorsList
                        .filter((c) => {
                          if (!connectorSearch.trim()) return true;
                          const q = connectorSearch.toLowerCase();
                          return (
                            c.name.toLowerCase().includes(q) ||
                            c.description.toLowerCase().includes(q) ||
                            c.type.toLowerCase().includes(q) ||
                            c.tools.some((t) => t.name.toLowerCase().includes(q))
                          );
                        })
                        .map((connector) => {
                          const testInfo = connectorTestResults[connector.id];
                          const isTesting = testingConnectorId === connector.id;
                          return (
                            <div
                              key={connector.id}
                              className="rounded-xl border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] p-4 transition-all flex flex-col gap-2.5 bg-[rgba(255,255,255,0.02)]"
                              style={{ opacity: connector.enabled ? 1 : 0.6 }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="font-semibold text-sm text-white">
                                    {connector.name}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase tracking-wider bg-[rgba(255,255,255,0.06)] text-neutral-300 border border-[rgba(255,255,255,0.06)]">
                                    {connector.type}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                      connector.status === "ready" || connector.status === "connected"
                                        ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/40"
                                        : connector.status === "error"
                                        ? "bg-red-950/40 text-red-300 border border-red-800/40"
                                        : "bg-neutral-800 text-neutral-400"
                                    }`}
                                  >
                                    ● {connector.status}
                                  </span>
                                </div>

                                {/* Clean Dark & White Toggle Switch */}
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[var(--text-secondary)]">
                                    {connector.enabled ? "Enabled" : "Disabled"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleConnector(connector.id, !connector.enabled)}
                                    className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0 ${
                                      connector.enabled ? "bg-neutral-400" : "bg-neutral-800"
                                    }`}
                                    aria-label="Toggle connector enabled"
                                  >
                                    <div
                                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                                        connector.enabled ? "translate-x-4" : "translate-x-0"
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>

                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                {connector.description}
                              </p>

                              {/* Tools Chips */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {connector.tools.map((t) => (
                                  <span
                                    key={t.name}
                                    className="text-[10px] px-2 py-0.5 rounded bg-[rgba(0,0,0,0.25)] text-neutral-300 font-mono border border-[rgba(255,255,255,0.05)]"
                                  >
                                    /{t.name}
                                  </span>
                                ))}
                              </div>

                              {/* Test Result Bar */}
                              {testInfo && (
                                <div
                                  className={`px-3 py-1.5 rounded-lg text-[11px] flex items-center justify-between border ${
                                    testInfo.success
                                      ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                                      : "bg-red-950/20 border-red-800/40 text-red-300"
                                  }`}
                                >
                                  <span>{testInfo.success ? "✓" : "⚠️"} {testInfo.message}</span>
                                  {testInfo.latencyMs !== undefined && <span className="font-mono">{testInfo.latencyMs}ms</span>}
                                </div>
                              )}

                              {/* Footer Controls */}
                              <div className="flex items-center justify-between gap-3 pt-2 border-t border-[rgba(255,255,255,0.06)]">
                                <div className="text-[11px] text-[var(--text-secondary)]">
                                  {connector.tools.length} tool{connector.tools.length !== 1 ? "s" : ""} active
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleTestConnector(connector.id)}
                                    disabled={isTesting}
                                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)] hover:text-white border border-[rgba(255,255,255,0.06)] transition-all cursor-pointer disabled:opacity-50"
                                  >
                                    {isTesting ? "Testing..." : "Test"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedConnector(connector);
                                      setConnectorsViewMode("detail");
                                    }}
                                    className="px-3 py-1 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-white border border-[rgba(255,255,255,0.08)] transition-all cursor-pointer"
                                  >
                                    View Details
                                  </button>
                                  {!connector.id.startsWith("builtin-") && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditConnector({
                                            isNew: false,
                                            id: connector.id,
                                            name: connector.name,
                                            description: connector.description,
                                            type: connector.type,
                                            category: connector.category,
                                            command: connector.config.command || "",
                                            args: (connector.config.args || []).join(" "),
                                            env: connector.config.env ? JSON.stringify(connector.config.env, null, 2) : "",
                                            url: connector.config.url || "",
                                            headers: connector.config.headers ? JSON.stringify(connector.config.headers, null, 2) : "",
                                            timeoutMs: connector.config.timeoutMs || 30000,
                                          });
                                          setEditConnectorError("");
                                          setConnectorsViewMode("edit");
                                        }}
                                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)] hover:text-white transition-all cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteConnector(connector.id)}
                                        className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer"
                                        title="Delete connector"
                                      >
                                        <TrashIcon size={14} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    /* ── Sub-tab 2: MCP Presets Catalog ── */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                      {connectorPresets
                        .filter((p) => {
                          if (!connectorSearch.trim()) return true;
                          const q = connectorSearch.toLowerCase();
                          return (
                            p.name.toLowerCase().includes(q) ||
                            p.description.toLowerCase().includes(q) ||
                            p.type.toLowerCase().includes(q)
                          );
                        })
                        .map((preset) => (
                          <div
                            key={preset.id}
                            className="rounded-xl border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] p-4 flex flex-col justify-between gap-3 bg-[rgba(255,255,255,0.02)] transition-all"
                          >
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm text-white">
                                  {preset.name}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase bg-[rgba(255,255,255,0.06)] text-neutral-300">
                                  {preset.type}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                {preset.description}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {preset.defaultTools.map((t) => (
                                  <span key={t.name} className="text-[10px] px-2 py-0.5 rounded bg-[rgba(0,0,0,0.3)] text-[var(--text-secondary)] font-mono">
                                    /{t.name}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-end pt-2 border-t border-[rgba(255,255,255,0.06)]">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditConnector({
                                    isNew: true,
                                    id: `mcp-${Date.now()}`,
                                    name: preset.name,
                                    description: preset.description,
                                    type: preset.type,
                                    category: preset.category,
                                    command: preset.defaultConfig.command || "",
                                    args: (preset.defaultConfig.args || []).join(" "),
                                    env: preset.defaultConfig.env ? JSON.stringify(preset.defaultConfig.env, null, 2) : "",
                                    url: preset.defaultConfig.url || "",
                                    headers: preset.defaultConfig.headers ? JSON.stringify(preset.defaultConfig.headers, null, 2) : "",
                                    timeoutMs: 30000,
                                  });
                                  setEditConnectorError("");
                                  setConnectorsViewMode("edit");
                                }}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer shadow-sm"
                              >
                                <PlusIcon size={12} />
                                <span>Configure & Add</span>
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : activeTab === "plugins" ? (
            <div className="flex flex-col gap-4 max-w-3xl mt-1 pr-2 h-full overflow-y-auto">

              {/* Action feedback banner */}
              {pluginActionMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between border animate-fade-in ${
                    pluginActionMessage.type === "success"
                      ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
                      : "bg-red-950/30 border-red-800/50 text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckIcon size={14} />
                    <span>{pluginActionMessage.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPluginActionMessage(null)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  VIEW MODE: DETAIL / INSPECT PLUGIN
              ────────────────────────────────────────────────────────── */}
              {pluginsViewMode === "detail" && selectedPlugin ? (
                <div className="flex flex-col gap-4 animate-fade-in pb-8">
                  {/* Back button & actions */}
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => {
                        setPluginsViewMode("list");
                        setSelectedPlugin(null);
                      }}
                      className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer group"
                    >
                      <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
                      <span>Back to Plugins</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePlugin(selectedPlugin.id, !selectedPlugin.enabled)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                          selectedPlugin.enabled
                            ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300 hover:bg-emerald-950/50"
                            : "bg-[rgba(255,255,255,0.06)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.1)]"
                        }`}
                      >
                        {selectedPlugin.enabled ? "Active" : "Disabled"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlugin(selectedPlugin.id, selectedPlugin.name)}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                        title="Uninstall Plugin"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Plugin Header Banner */}
                  <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-semibold text-[var(--text-primary)]">
                            {selectedPlugin.name}
                          </h2>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)]">
                            v{selectedPlugin.version}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold tracking-wider bg-[rgba(255,255,255,0.06)] text-neutral-300">
                            {selectedPlugin.category}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)]">
                            Source: {selectedPlugin.source}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                          {selectedPlugin.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-[var(--text-secondary)] pt-2 border-t border-[var(--border-subtle)] flex-wrap">
                      {selectedPlugin.author && <span>Author: <strong className="text-[var(--text-primary)]">{selectedPlugin.author}</strong></span>}
                      {selectedPlugin.license && <span>License: <strong className="text-[var(--text-primary)]">{selectedPlugin.license}</strong></span>}
                      {selectedPlugin.repository && (
                        <a
                          href={selectedPlugin.repository}
                          target="_blank"
                          rel="noreferrer"
                          className="text-neutral-300 hover:underline flex items-center gap-1"
                        >
                          <span>Repository ↗</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Detail Subtabs */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] w-fit">
                    <button
                      type="button"
                      onClick={() => setPluginDetailTab("skills")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        pluginDetailTab === "skills"
                          ? "bg-white text-neutral-900 shadow-sm"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Bundled Skills ({selectedPlugin.bundledSkills.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPluginDetailTab("mcp")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        pluginDetailTab === "mcp"
                          ? "bg-white text-neutral-900 shadow-sm"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      MCP Tools ({selectedPlugin.bundledMcpServers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPluginDetailTab("manifest")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        pluginDetailTab === "manifest"
                          ? "bg-white text-neutral-900 shadow-sm"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      Manifest (plugin.json)
                    </button>
                  </div>

                  {/* Detail Content */}
                  {pluginDetailTab === "skills" && (
                    <div className="flex flex-col gap-3">
                      {selectedPlugin.bundledSkills.length === 0 ? (
                        <div className="p-6 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-center text-xs text-[var(--text-secondary)]">
                          No bundled skills in this plugin package.
                        </div>
                      ) : (
                        selectedPlugin.bundledSkills.map((skill) => (
                          <div
                            key={skill.name}
                            className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex flex-col gap-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <SkillsIcon size={14} className="text-neutral-300" />
                                <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                                  /{skill.name}
                                </span>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] font-mono">
                                SKILL.MD
                              </span>
                            </div>
                            <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.04)] text-xs">
                              <MarkdownRenderer content={skill.instructions} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {pluginDetailTab === "mcp" && (
                    <div className="flex flex-col gap-3">
                      {selectedPlugin.bundledMcpServers.length === 0 ? (
                        <div className="p-6 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-center text-xs text-[var(--text-secondary)]">
                          No bundled MCP servers in this plugin package.
                        </div>
                      ) : (
                        selectedPlugin.bundledMcpServers.map((mcp) => (
                          <div
                            key={mcp.name}
                            className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex flex-col gap-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <DatabaseIcon size={14} className="text-neutral-300" />
                                <span className="text-xs font-semibold text-[var(--text-primary)] font-mono">
                                  {mcp.name}
                                </span>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] uppercase font-mono">
                                {mcp.type}
                              </span>
                            </div>
                            <pre className="p-3 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.04)] text-[11px] font-mono text-neutral-300 overflow-x-auto">
                              {JSON.stringify(mcp.config, null, 2)}
                            </pre>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {pluginDetailTab === "manifest" && (
                    <div className="flex flex-col gap-2">
                      <pre className="p-4 rounded-xl bg-[rgba(0,0,0,0.35)] border border-[var(--border-subtle)] text-[11px] font-mono text-neutral-300 overflow-x-auto leading-relaxed">
                        {JSON.stringify(selectedPlugin.manifest, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                /* ──────────────────────────────────────────────────────────
                    VIEW MODE: LIST & MARKETPLACE
                ────────────────────────────────────────────────────────── */
                <div className="flex flex-col gap-4 pb-8">
                  {/* Top Header */}
                  <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[var(--border-subtle)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                          Claude & Agent Plugins
                        </h2>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-[rgba(255,255,255,0.06)] text-neutral-300">
                          SUPER-BUNDLE
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        Modular extensions bundling skills, MCP server tools, commands, and hooks.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPluginDownloadPanel((v) => !v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-[var(--text-primary)] transition-colors cursor-pointer border border-[var(--border-subtle)]"
                      >
                        <UserPlusIcon size={13} />
                        <span>Install from GitHub</span>
                      </button>
                      <button
                        type="button"
                        onClick={fetchPluginsList}
                        disabled={pluginsLoading}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
                        title="Refresh Plugins"
                      >
                        <RefreshIcon size={14} className={pluginsLoading ? "animate-spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {/* GitHub Downloader Panel */}
                  {showPluginDownloadPanel && (
                    <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] flex flex-col gap-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                          Download Claude Plugin from GitHub
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowPluginDownloadPanel(false)}
                          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={pluginDownloadUrl}
                          onChange={(e) => setPluginDownloadUrl(e.target.value)}
                          placeholder="GitHub repository URL (e.g. owner/repo or https://github.com/owner/repo)"
                          className="w-full px-3 py-2 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-neutral-400 font-mono"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={pluginDownloadName}
                            onChange={(e) => setPluginDownloadName(e.target.value)}
                            placeholder="Optional custom plugin name override"
                            className="flex-1 px-3 py-2 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-neutral-400"
                          />
                          <button
                            type="button"
                            onClick={handleDownloadPlugin}
                            disabled={pluginDownloadStatus.type === "loading" || !pluginDownloadUrl.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                            {pluginDownloadStatus.type === "loading" ? "Downloading..." : "Download & Install"}
                          </button>
                        </div>
                      </div>

                      {pluginDownloadStatus.type !== "idle" && pluginDownloadStatus.message && (
                        <div
                          className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                            pluginDownloadStatus.type === "success"
                              ? "bg-emerald-950/30 text-emerald-300 border border-emerald-800/50"
                              : pluginDownloadStatus.type === "error"
                              ? "bg-red-950/30 text-red-300 border border-red-800/50"
                              : "bg-neutral-900 text-neutral-300 border border-neutral-700"
                          }`}
                        >
                          <span>{pluginDownloadStatus.message}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Subtabs: Installed vs Marketplace */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                      <button
                        type="button"
                        onClick={() => setPluginsSubTab("installed")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          pluginsSubTab === "installed"
                            ? "bg-white text-neutral-900 shadow-sm"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        Installed Plugins ({pluginsList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPluginsSubTab("catalog")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          pluginsSubTab === "catalog"
                            ? "bg-white text-neutral-900 shadow-sm"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        Plugin Marketplace ({curatedPluginsList.length})
                      </button>
                    </div>

                    {/* Search filter */}
                    <div className="relative min-w-[200px]">
                      <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] opacity-70" />
                      <input
                        type="text"
                        value={pluginSearch}
                        onChange={(e) => setPluginSearch(e.target.value)}
                        placeholder="Filter plugins..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-neutral-400"
                      />
                    </div>
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {["All", "development", "security", "devops", "data", "productivity"].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setPluginCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer capitalize ${
                          pluginCategoryFilter === cat
                            ? "bg-[rgba(255,255,255,0.15)] text-[var(--text-primary)] font-semibold"
                            : "bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)] hover:bg-[rgba(255,255,255,0.08)]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* TAB 1: INSTALLED PLUGINS */}
                  {pluginsSubTab === "installed" && (
                    <div className="flex flex-col gap-3">
                      {pluginsList
                        .filter((p) => {
                          const matchesSearch =
                            p.name.toLowerCase().includes(pluginSearch.toLowerCase()) ||
                            p.description.toLowerCase().includes(pluginSearch.toLowerCase());
                          const matchesCat =
                            pluginCategoryFilter === "All" || p.category === pluginCategoryFilter;
                          return matchesSearch && matchesCat;
                        })
                        .map((plugin) => (
                          <div
                            key={plugin.id}
                            className={`p-4 rounded-xl border transition-all flex flex-col gap-3 ${
                              plugin.enabled
                                ? "bg-[var(--bg-subtle)] border-[var(--border-subtle)] hover:border-[rgba(255,255,255,0.18)]"
                                : "bg-[var(--bg-subtle)]/40 border-[var(--border-subtle)]/50 opacity-60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                                    {plugin.name}
                                  </h3>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)]">
                                    v{plugin.version}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider bg-[rgba(255,255,255,0.06)] text-neutral-300">
                                    {plugin.category}
                                  </span>
                                </div>
                                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed">
                                  {plugin.description}
                                </p>
                              </div>

                              {/* Toggle switch */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlugin(plugin.id, !plugin.enabled)}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                                    plugin.enabled ? "bg-white" : "bg-neutral-800"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform ${
                                      plugin.enabled
                                        ? "translate-x-4 bg-neutral-900"
                                        : "translate-x-1 bg-neutral-400"
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Bundled summary chips & actions */}
                            <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)] flex-wrap gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] px-2 py-0.5 rounded bg-[rgba(0,0,0,0.3)] text-neutral-300 font-mono">
                                  {plugin.bundledSkills.length} Skills
                                </span>
                                <span className="text-[11px] px-2 py-0.5 rounded bg-[rgba(0,0,0,0.3)] text-neutral-300 font-mono">
                                  {plugin.bundledMcpServers.length} MCP Tools
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlugin(plugin);
                                    setPluginDetailTab("skills");
                                    setPluginsViewMode("detail");
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-[var(--text-primary)] transition-colors cursor-pointer"
                                >
                                  Inspect Bundle
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePlugin(plugin.id, plugin.name)}
                                  className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-950/30 transition-colors cursor-pointer"
                                  title="Uninstall Plugin"
                                >
                                  <TrashIcon size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                      {pluginsList.length === 0 && (
                        <div className="p-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-center flex flex-col items-center gap-2">
                          <span className="text-2xl">📦</span>
                          <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                            No plugins installed yet
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)] max-w-sm">
                            Browse the <strong>Plugin Marketplace</strong> tab to install curated bundles or install any plugin directly from GitHub.
                          </p>
                          <button
                            type="button"
                            onClick={() => setPluginsSubTab("catalog")}
                            className="mt-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer shadow-sm"
                          >
                            Explore Marketplace
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: PLUGIN MARKETPLACE */}
                  {pluginsSubTab === "catalog" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {curatedPluginsList
                        .filter((item) => {
                          const matchesSearch =
                            item.name.toLowerCase().includes(pluginSearch.toLowerCase()) ||
                            item.description.toLowerCase().includes(pluginSearch.toLowerCase()) ||
                            item.tags.some((t) => t.toLowerCase().includes(pluginSearch.toLowerCase()));
                          const matchesCat =
                            pluginCategoryFilter === "All" || item.category === pluginCategoryFilter;
                          return matchesSearch && matchesCat;
                        })
                        .map((item) => {
                          const isInstalled = pluginsList.some((p) => p.id === item.id);
                          const isInstalling = installingPluginId === item.id;

                          return (
                            <div
                              key={item.id}
                              className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[rgba(255,255,255,0.18)] transition-all flex flex-col justify-between gap-3 group"
                            >
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                                        {item.name}
                                      </h3>
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)]">
                                        v{item.version}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-[var(--text-secondary)]">
                                      by {item.author}
                                    </span>
                                  </div>
                                  <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold tracking-wider bg-[rgba(255,255,255,0.06)] text-neutral-300">
                                    {item.category}
                                  </span>
                                </div>

                                <p className="text-xs text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                                  {item.description}
                                </p>

                                {/* Bundled items preview */}
                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                  {item.skills.map((s) => (
                                    <span
                                      key={s.name}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(0,0,0,0.3)] text-[var(--text-secondary)] font-mono"
                                    >
                                      /{s.name}
                                    </span>
                                  ))}
                                  {item.mcpServers && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-neutral-300 font-mono">
                                      + MCP Server
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-end pt-2 border-t border-[rgba(255,255,255,0.05)]">
                                {isInstalled ? (
                                  <span className="text-xs font-medium text-emerald-400 flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-950/30 border border-emerald-800/40">
                                    <CheckIcon size={12} />
                                    <span>Installed</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleInstallCuratedPlugin(item.id)}
                                    disabled={isInstalling}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isInstalling ? (
                                      <>
                                        <RefreshIcon size={12} className="animate-spin" />
                                        <span>Installing...</span>
                                      </>
                                    ) : (
                                      <>
                                        <PlusIcon size={12} />
                                        <span>1-Click Install</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Stub message for other tabs
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 mt-10">
              <span className="text-3xl mb-4 opacity-50">🛠️</span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                {tabs.find(t => t.id === activeTab)?.label} Settings
              </h3>
              <p className="text-xs-ui text-[var(--text-secondary)] opacity-85 max-w-sm">
                This settings pane is disabled in the v1 workspace. All core configurations are managed under the <strong>General</strong> tab.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
