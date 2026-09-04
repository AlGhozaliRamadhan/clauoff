"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDownIcon, ChevronRightIcon, CheckIcon, SettingsIcon } from "@/components/ui/Icons";

function ChevronLeftIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

interface LocalModel {
  id: string;
  label: string;
  backend?: string;
}

interface ProfileItem {
  id: string;
  name: string;
  backendUrl: string;
  defaultModel: string;
  imageModel?: string;
  isActive?: boolean;
}

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  onOpenSettings?: () => void;
  /** When true, the dropdown acts as an image-model picker: no effort UI,
   *  trigger shows just the model name, and auto-select prefers the
   *  active profile's imageModel. (ADR-0018 change log 2026-09-04) */
  hideEffort?: boolean;
}

const EFFORT_KEY = "cogito.effort.v2";
const THINKING_KEY = "cogito.thinking.v2";

type SubView = "main" | "effort" | "profiles";

export function ModelSelector({ selectedModel, onModelChange, onOpenSettings, hideEffort = false }: ModelSelectorProps) {
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [activeProfile, setActiveProfile] = useState<ProfileItem | null>(null);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<SubView>("main");
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitchingProfile, setIsSwitchingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Custom dropdown states
  const [effort, setEffort] = useState<string>("Medium");
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(true);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch local models & profiles from backend
  const fetchModels = useCallback(async (preferredModelId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/models");
      const data = await res.json().catch(() => ({}));
      
      const fetchedModels: LocalModel[] = Array.isArray(data.models) ? data.models : [];
      setLocalModels(fetchedModels);
      setActiveProfile(data.activeProfile || null);
      setProfiles(Array.isArray(data.profiles) ? data.profiles : []);

      if (!res.ok) {
        throw new Error(data.error || `Failed to fetch models (${res.status})`);
      }

      // Auto-select logic. In image mode prefer the profile's imageModel
      // (falling back to its chat default), otherwise use the chat default.
      // An already-selected model that's still on this backend wins over the
      // profile default so an explicit pick survives remounts/re-fetches.
      if (fetchedModels.length > 0) {
        const profileDefault = hideEffort
          ? (data.activeProfile?.imageModel || data.activeProfile?.defaultModel || "")
          : (data.activeProfile?.defaultModel ?? "");
        const currentValid = selectedModel && fetchedModels.some((m) => m.id === selectedModel)
          ? selectedModel
          : "";
        const targetModel = preferredModelId || currentValid || profileDefault;
        if (targetModel && fetchedModels.some((m) => m.id === targetModel)) {
          onModelChange(targetModel);
        } else if (!selectedModel || !fetchedModels.some((m) => m.id === selectedModel)) {
          onModelChange(fetchedModels[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
    } finally {
      setIsLoading(false);
    }
  }, [onModelChange, selectedModel, hideEffort]);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Listen for global profile changes from SettingsModal
  useEffect(() => {
    const handleProfileChanged = () => {
      fetchModels();
    };
    window.addEventListener("cogito:profile-changed", handleProfileChanged);
    return () => window.removeEventListener("cogito:profile-changed", handleProfileChanged);
  }, [fetchModels]);

  // Load configuration from localStorage once on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedEffort = localStorage.getItem(EFFORT_KEY) as "Low" | "Medium" | "High" | "Extra" | "Max" | null;
      const storedThinking = localStorage.getItem(THINKING_KEY);

      if (storedEffort) {
        setTimeout(() => setEffort(storedEffort), 0);
      }
      if (storedThinking) {
        setTimeout(() => setThinkingEnabled(storedThinking === "true"), 0);
      }
    }
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setCurrentView("main");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle changing model
  const handleSelectModel = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
    setCurrentView("main");
  };

  // Handle switching active profile directly from dropdown
  const handleSwitchProfile = async (profileId: string) => {
    if (profileId === activeProfile?.id) {
      setCurrentView("main");
      return;
    }
    setIsSwitchingProfile(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeId: profileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setActiveProfile(data.activeProfile || null);
        setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
        const nextModels = Array.isArray(data.models) ? data.models : [];
        setLocalModels(nextModels);
        
        const defaultForProfile = hideEffort
          ? (data.activeProfile?.imageModel || data.activeProfile?.defaultModel)
          : data.activeProfile?.defaultModel;
        if (defaultForProfile && nextModels.some((m: LocalModel) => m.id === defaultForProfile)) {
          onModelChange(defaultForProfile);
        } else if (nextModels.length > 0) {
          onModelChange(nextModels[0].id);
        }

        // Notify other components
        window.dispatchEvent(new CustomEvent("cogito:profile-changed"));
        setCurrentView("main");
      } else {
        throw new Error(data.error || "Failed to switch API profile");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profile switch failed");
    } finally {
      setIsSwitchingProfile(false);
    }
  };

  // Toggle effort level
  const handleSelectEffort = (level: string) => {
    setEffort(level);
    localStorage.setItem(EFFORT_KEY, level);
  };

  // Toggle thinking switch
  const handleToggleThinking = (val: boolean) => {
    setThinkingEnabled(val);
    localStorage.setItem(THINKING_KEY, val ? "true" : "false");
  };

  // Get display label for active trigger button
  const getTriggerLabel = () => {
    if (isLoading) return "Loading…";
    if (isSwitchingProfile) return "Switching…";
    if (error && localModels.length === 0) return "Select model";
    
    if (selectedModel) {
      const model = localModels.find((m) => m.id === selectedModel);
      const name = model ? model.label : selectedModel;
      if (!hideEffort && thinkingEnabled) {
        return `${name} ${effort}`;
      }
      return name;
    }
    
    return "Select model";
  };

  const getCleanBackendHost = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.host;
    } catch {
      return url || "Local Backend";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button capsule */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setCurrentView("main");
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-150 cursor-pointer hover:bg-[rgba(255,255,255,0.08)] font-medium text-sm-ui ${
          isOpen ? "bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
        aria-label="Select model"
        aria-expanded={isOpen}
      >
        <span className="truncate max-w-[240px]">{getTriggerLabel()}</span>
        <ChevronDownIcon
          size={14}
          className={`flex-shrink-0 transition-transform duration-150 opacity-70 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Main Dropdown Panel - positioned right-0 to prevent horizontal overflow */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-2 right-0 w-[300px] rounded-2xl py-2 z-50 animate-fade-in flex flex-col overflow-hidden"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-dropdown)",
          }}
        >
          {/* ========================================================= */}
          {/* 1. MAIN VIEW: API Profile Bar, Model List, Effort Trigger */}
          {/* ========================================================= */}
          {currentView === "main" && (
            <>
              {/* API Profile Header */}
              {profiles.length > 1 ? (
                <div className="px-3 pb-2 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">API Connection</span>
                    <button
                      onClick={() => setCurrentView("profiles")}
                      className="text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>{activeProfile?.name || "Switch"}</span>
                      <ChevronRightIcon size={12} />
                    </button>
                  </div>
                </div>
              ) : activeProfile ? (
                <div className="px-4 py-1.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate">
                    {activeProfile.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-70 font-mono truncate">
                    {activeProfile.backendUrl ? getCleanBackendHost(activeProfile.backendUrl) : "local"}
                  </span>
                </div>
              ) : null}

              {/* Models List or Errors */}
              {error && localModels.length === 0 ? (
                <div className="px-4 py-3 text-center">
                  <p className="text-xs mb-2 text-amber-400 font-medium">{error}</p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => fetchModels()}
                      className="text-xs px-2.5 py-1 rounded-lg cursor-pointer text-[var(--accent-primary)] bg-[var(--border-subtle)]"
                    >
                      Retry
                    </button>
                    {onOpenSettings && (
                      <button
                        onClick={() => {
                          setIsOpen(false);
                          onOpenSettings();
                        }}
                        className="text-xs px-2.5 py-1 rounded-lg cursor-pointer text-[var(--text-primary)] bg-[rgba(255,255,255,0.08)]"
                      >
                        Settings
                      </button>
                    )}
                  </div>
                </div>
              ) : localModels.length === 0 && !isLoading ? (
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-[var(--text-secondary)] mb-2">No models detected.</p>
                  {profiles.length > 1 && (
                    <button
                      onClick={() => setCurrentView("profiles")}
                      className="text-xs px-2.5 py-1 rounded-lg cursor-pointer text-[var(--accent-primary)] bg-[var(--border-subtle)] mr-2"
                    >
                      Switch API
                    </button>
                  )}
                  {onOpenSettings && (
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        onOpenSettings();
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg cursor-pointer text-[var(--text-primary)] bg-[rgba(255,255,255,0.08)]"
                    >
                      Settings
                    </button>
                  )}
                </div>
              ) : (
                <div className="max-h-[220px] overflow-y-auto py-1">
                  {localModels.map((model) => {
                    const isSelected = selectedModel === model.id;
                    return (
                      <div
                        key={model.id}
                        className="group flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-left transition-colors duration-100 min-w-0"
                        onClick={() => handleSelectModel(model.id)}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold text-sm-ui ${isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`}>
                              {model.label}
                            </span>
                          </div>
                          <span className="text-[11px] text-[var(--text-secondary)] opacity-80 leading-normal truncate font-mono">
                            {model.id}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isSelected && (
                            <CheckIcon size={16} className="text-[#1062c3] flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!hideEffort && (
                <>
                  <div className="my-1 border-t border-[var(--border-subtle)]" />

                  {/* Effort & Thinking Navigation Row */}
                  <div
                    className="flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer transition-colors duration-100"
                    onClick={() => setCurrentView("effort")}
                  >
                    <span className="text-sm-ui font-medium text-[var(--text-secondary)]">Effort & Thinking</span>
                    <div className="flex items-center gap-1 text-[var(--text-secondary)] opacity-80">
                      <span className="text-xs">{thinkingEnabled ? effort : "Off"}</span>
                      <ChevronRightIcon size={14} />
                    </div>
                  </div>
                </>
              )}

              {/* Settings Shortcut */}
              {onOpenSettings && (
                <div
                  className="flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer transition-colors duration-100 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSettings();
                  }}
                >
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <SettingsIcon size={14} />
                    <span>Manage Settings</span>
                  </div>
                  <span className="text-[10px] opacity-60">Ctrl+,</span>
                </div>
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* 2. EFFORT & THINKING IN-PLACE VIEW */}
          {/* ========================================================= */}
          {currentView === "effort" && (
            <div className="flex flex-col gap-2.5 p-3">
              {/* Back Header */}
              <div className="flex items-center gap-2 pb-1 border-b border-[var(--border-subtle)]">
                <button
                  onClick={() => setCurrentView("main")}
                  className="p-1 rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                  aria-label="Back to models"
                >
                  <ChevronLeftIcon size={16} />
                </button>
                <span className="text-xs font-semibold text-[var(--text-primary)]">Effort & Thinking</span>
              </div>

              <div className="text-[11px] text-[var(--text-secondary)] leading-normal opacity-90 px-1">
                Higher effort produces more thorough responses, but takes longer.
              </div>

              {/* Effort levels */}
              <div className={`flex flex-col rounded-xl overflow-hidden bg-[rgba(0,0,0,0.15)] ${!thinkingEnabled ? "opacity-40 pointer-events-none" : ""}`}>
                {["Low", "Medium", "High", "Extra", "Max"].map((level) => {
                  const isChecked = effort === level;
                  return (
                    <button
                      key={level}
                      disabled={!thinkingEnabled}
                      onClick={() => handleSelectEffort(level)}
                      className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors text-sm-ui"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={isChecked ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-secondary)]"}>
                          {level}
                        </span>
                        {level === "Medium" && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[rgba(255,255,255,0.1)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                            Default
                          </span>
                        )}
                        {level === "Max" && (
                          <InfoIcon size={12} className="text-[var(--text-secondary)] opacity-70" />
                        )}
                      </div>
                      {isChecked && <CheckIcon size={14} className="text-[#1062c3]" />}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-[var(--border-subtle)] my-0.5" />

              {/* Thinking Switch */}
              <div className="flex items-center justify-between px-1">
                <div className="flex flex-col pr-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Thinking Mode</span>
                  <span className="text-[10px] text-[var(--text-secondary)] opacity-80">
                    Deep reasoning for complex tasks
                  </span>
                </div>
                <button
                  onClick={() => handleToggleThinking(!thinkingEnabled)}
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 ${
                    thinkingEnabled ? "bg-[#1062c3]" : "bg-neutral-600"
                  }`}
                  aria-label="Toggle thinking effort"
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                      thinkingEnabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. API PROFILES IN-PLACE VIEW */}
          {/* ========================================================= */}
          {currentView === "profiles" && (
            <div className="flex flex-col gap-2 p-3">
              {/* Back Header */}
              <div className="flex items-center justify-between pb-1 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentView("main")}
                    className="p-1 rounded-lg hover:bg-[rgba(255,255,255,0.08)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                    aria-label="Back to models"
                  >
                    <ChevronLeftIcon size={16} />
                  </button>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Select API Backend</span>
                </div>
                {isSwitchingProfile && (
                  <span className="text-[10px] text-[var(--accent-primary)] animate-pulse">Switching…</span>
                )}
              </div>

              {/* Profiles List */}
              <div className="flex flex-col rounded-xl overflow-hidden bg-[rgba(0,0,0,0.15)] max-h-[220px] overflow-y-auto">
                {profiles.map((p) => {
                  const isActive = p.id === activeProfile?.id;
                  return (
                    <button
                      key={p.id}
                      disabled={isSwitchingProfile}
                      onClick={() => handleSwitchProfile(p.id)}
                      className="flex items-center justify-between w-full px-3 py-2.5 text-left hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors text-sm-ui"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className={isActive ? "text-[var(--text-primary)] font-semibold text-xs truncate" : "text-[var(--text-secondary)] text-xs truncate"}>
                          {p.name}
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)] opacity-70 font-mono truncate">
                          {p.backendUrl ? getCleanBackendHost(p.backendUrl) : "Local"}
                        </span>
                      </div>
                      {isActive && <CheckIcon size={14} className="text-[#1062c3] flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {onOpenSettings && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onOpenSettings();
                  }}
                  className="mt-1 text-xs py-1.5 px-2 rounded-lg text-center bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.09)] text-[var(--accent-primary)] font-medium cursor-pointer transition-colors"
                >
                  + Add / Edit in Settings
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
