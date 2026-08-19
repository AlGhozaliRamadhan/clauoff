"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDownIcon, ChevronRightIcon, CheckIcon, SettingsIcon } from "./Icons";

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

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

const EFFORT_KEY = "cogito.effort.v2";
const THINKING_KEY = "cogito.thinking.v2";

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Custom Claude dropdown states
  const [effort, setEffort] = useState<string>("Medium");
  const [thinkingEnabled, setThinkingEnabled] = useState<boolean>(true);
  
  // Submenu states: null | "effort"
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch models on mount
  useEffect(() => {
    fetchModels();
  }, []);

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
        setActiveSubmenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch local models from backend
  async function fetchModels() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/models");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to fetch models (${res.status})`);
      }
      const data = await res.json();
      const fetchedModels: LocalModel[] = data.models || [];
      setLocalModels(fetchedModels);

      // If no model is selected, auto-select first available
      if (fetchedModels.length > 0) {
        if (!selectedModel || !fetchedModels.some(m => m.id === selectedModel)) {
          onModelChange(fetchedModels[0].id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
      setLocalModels([]);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle changing model
  const handleSelectModel = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
    setActiveSubmenu(null);
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
    if (error) return "⚠ Error";
    
    if (selectedModel) {
      const model = localModels.find(m => m.id === selectedModel);
      const name = model ? model.label : selectedModel;
      if (thinkingEnabled) {
        return `${name} ${effort}`;
      }
      return name;
    }
    
    return "Select model";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button capsule */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setActiveSubmenu(null);
        }}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-150 cursor-pointer hover:bg-[rgba(255,255,255,0.08)] font-medium text-sm-ui ${
          isOpen ? "bg-[rgba(255,255,255,0.08)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}
        aria-label="Select model"
        aria-expanded={isOpen}
      >
        <span className="truncate max-w-[250px]">{getTriggerLabel()}</span>
        <ChevronDownIcon
          size={14}
          className={`flex-shrink-0 transition-transform duration-150 opacity-70 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Main Dropdown Panel */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-2 left-0 w-[300px] rounded-2xl py-2 z-50 animate-fade-in flex flex-col"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-dropdown)",
          }}
        >
          {error ? (
            <div className="px-4 py-3 text-center">
              <p className="text-sm-ui mb-2 text-[var(--text-secondary)]">{error}</p>
              <button
                onClick={fetchModels}
                className="text-sm-ui px-3 py-1 rounded-lg cursor-pointer text-[var(--accent-primary)] bg-[var(--border-subtle)]"
              >
                Retry
              </button>
            </div>
          ) : localModels.length === 0 && !isLoading ? (
            <div className="px-4 py-3 text-center text-sm-ui text-[var(--text-secondary)]">
              No models detected.
            </div>
          ) : (
            <>
              {/* API MODELS LIST */}
              <div className="max-h-[220px] overflow-y-auto">
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

              <div className="my-1.5 border-t border-[var(--border-subtle)]" />

              {/* EFFORT SUBMENU TRIGGER */}
              <div
                className={`flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer transition-colors duration-100 ${
                  activeSubmenu === "effort" ? "bg-[rgba(255,255,255,0.04)]" : ""
                }`}
                onMouseEnter={() => setActiveSubmenu("effort")}
                onClick={() => setActiveSubmenu(activeSubmenu === "effort" ? null : "effort")}
              >
                <span className="text-sm-ui font-medium text-[var(--text-secondary)]">Effort</span>
                <div className="flex items-center gap-1 text-[var(--text-secondary)] opacity-80">
                  <span className="text-xs">{thinkingEnabled ? effort : "Off"}</span>
                  <ChevronRightIcon size={14} />
                </div>
              </div>
            </>
          )}

          {/* -------------------------------------------------------------
              SUBMENUS - Absolute positioned side cards
             ------------------------------------------------------------- */}

          {/* 1. Effort Submenu */}
          {activeSubmenu === "effort" && (
            <div
              className="absolute left-full bottom-0 ml-2 w-[280px] rounded-2xl p-4 z-50 animate-fade-in flex flex-col gap-3"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-dropdown)",
              }}
            >
              <div className="text-[11px] text-[var(--text-secondary)] leading-normal opacity-90 pr-2">
                Higher effort means more thorough responses, but takes longer and uses your limits faster.
              </div>

              {/* Effort levels options */}
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
              <div className="flex items-center justify-between">
                <div className="flex flex-col pr-2">
                  <span className="text-sm-ui font-semibold text-[var(--text-primary)]">Thinking</span>
                  <span className="text-[11px] text-[var(--text-secondary)] opacity-80">
                    Can think for more complex tasks
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
        </div>
      )}
    </div>
  );
}
