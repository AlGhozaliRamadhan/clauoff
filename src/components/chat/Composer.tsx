"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { SendIcon, StopIcon, PlusIcon, VoiceIcon, MicIcon, WebSearchIcon, SkillsIcon } from "@/components/ui/Icons";
import { ModelSelector } from "./ModelSelector";
import { useAudio } from "@/contexts/AudioContext";
import type { VoiceSessionUiState } from "@/lib/audio/voice-session";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  placeholder?: string;
  isCompact?: boolean;
  /** When set, show project knowledge indicator (ADR-0005). */
  projectName?: string | null;
  /** Upload files into the active project library via the + button. */
  onAttachFiles?: (files: FileList) => void;
  /** Whether web search is currently enabled (ADR-0006). */
  webSearchEnabled?: boolean;
  /** Toggle web search on/off. */
  onWebSearchToggle?: (enabled: boolean) => void;
  onOpenSettings?: () => void;
  /** Persistent local-first hands-free conversation state (ADR-0016). */
  voiceSession: VoiceSessionUiState;
}

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming = false,
  selectedModel,
  onModelChange,
  placeholder = "How can I help you today?",
  isCompact = false,
  projectName = null,
  onAttachFiles,
  webSearchEnabled = false,
  onWebSearchToggle,
  onOpenSettings,
  voiceSession,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Skills Slash Command Auto-complete
  const [installedSkills, setInstalledSkills] = useState<Array<{ name: string; description: string; enabled: boolean }>>([]);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.skills)) {
          setInstalledSkills(data.skills);
        }
      })
      .catch(() => {});
  }, []);

  const slashQuery =
    value.startsWith("/") && !value.includes("\n") && !value.includes(" ")
      ? value.slice(1).toLowerCase()
      : null;

  const matchingSkills =
    slashQuery !== null
      ? installedSkills.filter((s) => s.enabled && s.name.toLowerCase().includes(slashQuery))
      : [];

  useEffect(() => {
    if (matchingSkills.length > 0 && slashQuery !== null) {
      setShowSkillDropdown(true);
      setSelectedSkillIndex(0);
    } else {
      setShowSkillDropdown(false);
    }
  }, [matchingSkills.length, slashQuery]);

  const selectSkill = (skillName: string) => {
    onChange(`/${skillName} `);
    setShowSkillDropdown(false);
    textareaRef.current?.focus();
  };

  const [noticeHint, setNoticeHint] = useState<string | null>(null);
  const isListening = voiceSession.enabled;
  const micLevel = voiceSession.level;
  const sttHint = voiceSession.hint || noticeHint;

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Cogito Voice Audio Context
  const { isPlaying, isGenerating, toggleVoice, voiceSettings, updateVoiceSettings, stopVoice } = useAudio();
  const isSpeaking = isPlaying || isGenerating;
  const isReadAloudOn = voiceSettings.autoPlay;

  const handleToggleReadAloud = useCallback(() => {
    if (isSpeaking) {
      stopVoice();
      return;
    }

    const nextState = !voiceSettings.autoPlay;
    updateVoiceSettings({ autoPlay: nextState });

    if (nextState) {
      setNoticeHint("Read aloud: On");
      setTimeout(() => setNoticeHint(null), 1800);

      // If there's an existing assistant response, read it immediately
      const assistantBubbles = document.querySelectorAll('[data-role="assistant-visible-text"]');
      if (assistantBubbles.length > 0) {
        const lastBubble = assistantBubbles[assistantBubbles.length - 1];
        const textToSpeak = (lastBubble.textContent || "").replace(/⚠.*/, "").trim();
        if (textToSpeak) {
          toggleVoice(textToSpeak, "composer-last-response");
        }
      }
    } else {
      setNoticeHint("Read aloud: Off");
      setTimeout(() => setNoticeHint(null), 1800);
    }
  }, [isSpeaking, stopVoice, voiceSettings.autoPlay, updateVoiceSettings, toggleVoice]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showSkillDropdown && matchingSkills.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSkillIndex((prev) => (prev + 1) % matchingSkills.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSkillIndex((prev) => (prev - 1 + matchingSkills.length) % matchingSkills.length);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        selectSkill(matchingSkills[selectedSkillIndex].name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSkillDropdown(false);
        return;
      }
    }

    // Enter sends, Shift+Enter adds newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isStreaming) {
        onSend();
      }
    }
  }

  const hasText = value.trim().length > 0;
  const isHearing = voiceSession.status === "hearing";

  return (
    <div
      className="relative rounded-2xl border transition-all duration-200"
      style={{
        background: "var(--surface-raised)",
        borderColor: isListening ? "var(--accent-primary)" : "var(--border-subtle)",
        boxShadow: isListening
          ? "0 0 16px color-mix(in srgb, var(--accent-primary) 20%, transparent)"
          : "var(--shadow-composer)",
      }}
    >
      {/* Skills Slash Command Autocomplete Popover */}
      {showSkillDropdown && matchingSkills.length > 0 && (
        <div
          className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl py-1.5 z-40 animate-fade-in shadow-2xl border flex flex-col max-h-56 overflow-y-auto"
          style={{
            background: "var(--surface-app)",
            borderColor: "rgba(255, 255, 255, 0.1)",
          }}
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[rgba(255,255,255,0.07)] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <SkillsIcon size={12} className="text-neutral-400" />
              <span>Available Skills</span>
            </span>
            <span className="text-[10px] opacity-70 font-normal">Tab or Enter to select</span>
          </div>

          {matchingSkills.map((skill, idx) => (
            <button
              key={skill.name}
              type="button"
              onClick={() => selectSkill(skill.name)}
              onMouseEnter={() => setSelectedSkillIndex(idx)}
              className={`flex items-center justify-between gap-3 px-3 py-2 text-left cursor-pointer transition-colors ${
                selectedSkillIndex === idx
                  ? "bg-[rgba(255,255,255,0.08)] text-white"
                  : "text-neutral-300 hover:bg-[rgba(255,255,255,0.03)]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-bold text-white flex-shrink-0">
                  /{skill.name}
                </span>
                <span className="text-xs text-[var(--text-secondary)] truncate">
                  {skill.description}
                </span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[rgba(255,255,255,0.06)] text-neutral-300 font-mono flex-shrink-0">
                Skill
              </span>
            </button>
          ))}
        </div>
      )}

      {sttHint && (
        <div className="absolute -top-9 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] shadow-md animate-fade-in flex items-center gap-1.5 z-20 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
          <span>{sttHint}</span>
        </div>
      )}

      {/* Textarea container */}
      <div className="flex items-start px-4 pt-3 pb-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent outline-none resize-none placeholder:text-[var(--text-secondary)]"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-lg)",
            lineHeight: "var(--lh-lg)",
            color: "var(--text-primary)",
            maxHeight: "200px",
            minHeight: isCompact ? "auto" : "56px", // 1 line in chat, 2 lines in empty state
            transition: "height 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          aria-label="Message input"
        />
      </div>

      {projectName && (
        <div
          className="px-3 pb-1"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "var(--text-xs)",
            color: "var(--text-secondary)",
          }}
        >
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            Using project knowledge: {projectName}
          </span>
        </div>
      )}

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between px-3 pb-2 pt-1">
        {/* Left: attach button and web search toggle */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              if (onAttachFiles) fileInputRef.current?.click();
            }}
            className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)] transition-colors text-[var(--text-secondary)] cursor-pointer disabled:opacity-40"
            aria-label="Attach file"
            disabled={!onAttachFiles}
            title={
              onAttachFiles
                ? "Upload to project library"
                : "Open a project to upload knowledge files"
            }
          >
            <PlusIcon size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".md,.txt,.pdf,.ts,.tsx,.js,.jsx,.py,.json,.css,.html,.rs,.go,.java,.c,.cpp,.h,.yml,.yaml,.toml,.sh"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0 && onAttachFiles) {
                onAttachFiles(e.target.files);
              }
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />

          {/* Web search toggle (ADR-0006) */}
          <button
            type="button"
            onClick={() => onWebSearchToggle?.(!webSearchEnabled)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              webSearchEnabled
                ? "text-[var(--accent-primary)] bg-[rgba(201,96,63,0.12)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--border-subtle)] hover:text-[var(--text-primary)]"
            }`}
            aria-label={webSearchEnabled ? "Disable web search" : "Enable web search"}
            aria-pressed={webSearchEnabled}
            title={webSearchEnabled ? "Web search: on" : "Web search: off"}
          >
            <WebSearchIcon size={18} />
          </button>
        </div>

        {/* Right: model selector + voice / send / stop */}
        <div className="flex items-center gap-2">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            onOpenSettings={onOpenSettings}
          />

          {/* Hands-free voice remains available while Cogito is generating. */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void voiceSession.toggle()}
              className={`relative flex items-center gap-1.5 p-2 rounded-xl transition-all duration-150 cursor-pointer ${
                isListening
                  ? isHearing ? "shadow-lg scale-[1.03]" : "shadow-md"
                  : "hover:bg-[var(--bg-sidebar-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
              style={isListening
                ? { background: "var(--accent-primary)", color: "var(--surface-app)" }
                : undefined}
              aria-label={isListening
                ? "Stop hands-free voice conversation"
                : "Start hands-free voice conversation"}
              aria-pressed={isListening}
              title={voiceSession.hint || "Start hands-free local voice"}
            >
              <MicIcon size={18} />
              {isListening && (
                <div className="flex items-center gap-[2px] h-3 px-0.5" aria-hidden="true">
                  {[1, 1.3, 0.8].map((scale, index) => (
                    <span
                      key={index}
                      className="w-[2px] rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(22, micLevel * 100 * scale)}%`,
                        background: "currentColor",
                      }}
                    />
                  ))}
                </div>
              )}
            </button>

            {!hasText && !voiceSession.enabled && (
              <button
                type="button"
                onClick={handleToggleReadAloud}
                className={`p-2 rounded-xl transition-all duration-150 cursor-pointer ${
                  isSpeaking
                    ? "text-[var(--accent-primary)] bg-[rgba(201,96,63,0.18)] animate-pulse"
                    : isReadAloudOn
                    ? "text-[var(--accent-primary)] bg-[rgba(201,96,63,0.12)]"
                    : "hover:bg-[var(--bg-sidebar-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                aria-label={isSpeaking ? "Stop reading aloud" : isReadAloudOn ? "Disable read aloud" : "Enable read aloud"}
                aria-pressed={isReadAloudOn}
                title={isSpeaking ? "Stop reading" : isReadAloudOn ? "Read aloud: On" : "Read aloud: Off"}
              >
                <VoiceIcon size={18} />
              </button>
            )}

            {isStreaming ? (
              <button
                onClick={onStop}
                className="p-2 rounded-xl transition-colors duration-150 cursor-pointer"
                style={{ background: "var(--text-secondary)", color: "var(--surface-app)" }}
                aria-label="Stop generating"
              >
                <StopIcon size={18} />
              </button>
            ) : hasText ? (
              <button
                onClick={onSend}
                className="p-2 rounded-xl transition-all duration-150 cursor-pointer"
                style={{ background: "var(--text-primary)", color: "var(--surface-sidebar)" }}
                aria-label="Send message"
              >
                <SendIcon size={18} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
