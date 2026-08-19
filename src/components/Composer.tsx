"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { SendIcon, StopIcon, PlusIcon, VoiceIcon, MicIcon, WebSearchIcon } from "./Icons";
import { ModelSelector } from "./ModelSelector";

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
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

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

  const [isSpeaking, setIsSpeaking] = useState(false);

  const speakLastResponse = useCallback(() => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    // Attempt to read the last assistant message text from the active conversation
    const assistantBubbles = document.querySelectorAll('[data-role="assistant-visible-text"]');
    let textToSpeak = "";
    if (assistantBubbles.length > 0) {
      const lastBubble = assistantBubbles[assistantBubbles.length - 1];
      textToSpeak = (lastBubble.textContent || "").replace(/⚠.*/, "").trim();
    }

    if (!textToSpeak) {
      textToSpeak = "Hi! I am Cogito, your AI assistant. Start chatting and I can read my responses back to you!";
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Web Speech recognition callbacks
  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        const speechToText = event.results[0][0].transcript;
        if (speechToText) {
          onChange(value + (value ? " " : "") + speechToText);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  }, [value, onChange]);

  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const handleVoiceClick = useCallback(() => {
    if (isListening) {
      stopSpeechRecognition();
    } else {
      startSpeechRecognition();
    }
  }, [isListening, startSpeechRecognition, stopSpeechRecognition]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isStreaming) {
        onSend();
      }
    }
  }

  const hasText = value.trim().length > 0;

  return (
    <div
      className="relative rounded-[var(--composer-radius)]"
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
      }}
    >
      {/* Textarea area */}
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
        {/* Left: attach button */}
        <div className="flex items-center">
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

        {/* Right: model selector + send/voice/stop */}
        <div className="flex items-center gap-2">
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={onModelChange}
          />

          {/* Send / Voice / Stop buttons */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="p-2 rounded-xl transition-colors duration-150 cursor-pointer"
              style={{
                background: "var(--text-secondary)",
                color: "var(--surface-app)",
              }}
              aria-label="Stop generating"
            >
              <StopIcon size={18} />
            </button>
          ) : hasText ? (
            <button
              onClick={onSend}
              className="p-2 rounded-xl transition-all duration-150 cursor-pointer"
              style={{
                background: "var(--text-primary)",
                color: "var(--surface-sidebar)",
              }}
              aria-label="Send message"
            >
              <SendIcon size={18} />
            </button>
          ) : (
            // Empty state composer: show Mic and Waveform buttons side-by-side
            <div className="flex items-center gap-1">
              {/* Mic Icon button for voice dictation */}
              <button
                onClick={handleVoiceClick}
                className={`p-2 rounded-xl transition-all duration-150 cursor-pointer ${
                  isListening
                    ? "bg-red-600 text-white animate-pulse"
                    : "hover:bg-[var(--bg-sidebar-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
              >
                <MicIcon size={18} />
              </button>

              {/* Waveform Icon button for TTS readout */}
              <button
                onClick={speakLastResponse}
                className={`p-2 rounded-xl transition-all duration-150 cursor-pointer ${
                  isSpeaking
                    ? "text-[var(--accent-primary)] bg-[rgba(201,96,63,0.12)] animate-pulse"
                    : "hover:bg-[var(--bg-sidebar-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                aria-label={isSpeaking ? "Stop read aloud" : "Read aloud last response"}
              >
                <VoiceIcon size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
