"use client";

import React, { useState, useEffect, useRef } from "react";
import { SettingsIcon, SearchIcon, ShieldCheckIcon, DatabaseIcon, UserPlusIcon, LockIcon, CheckIcon, SpeakerWaveIcon, SpeakerStopIcon } from "./Icons";
import { useAuth } from "@/contexts/AuthContext";
import { useAudio } from "@/contexts/AudioContext";
import { AVATAR_COLORS } from "@/lib/auth/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
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

function SkillsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
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

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, openAuthModal, logout, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("general");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
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
  };

  /** Activate a profile — saves immediately */
  const handleSetActive = async (id: string) => {
    const nextActiveId = id;
    await persistProfiles(apiProfiles, nextActiveId);
    setApiActiveId(nextActiveId);
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
