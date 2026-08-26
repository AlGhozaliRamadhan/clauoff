"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { SendIcon, StopIcon, PlusIcon, VoiceIcon, MicIcon, WebSearchIcon } from "./Icons";
import { ModelSelector } from "./ModelSelector";
import { useAudio } from "@/contexts/AudioContext";

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

  // Microphone and Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [sttHint, setSttHint] = useState<string | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");
  const fallbackToBackendRef = useRef<boolean>(false);

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
      setSttHint("Read aloud: On");
      setTimeout(() => setSttHint(null), 1800);

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
      setSttHint("Read aloud: Off");
      setTimeout(() => setSttHint(null), 1800);
    }
  }, [isSpeaking, stopVoice, voiceSettings.autoPlay, updateVoiceSettings, toggleVoice]);

  // Stop recording and process transcription
  const stopListening = useCallback(async () => {
    setIsListening(false);
    setMicLevel(0);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      mediaStreamRef.current = null;
    }

    // If native speech recognition was unavailable or hit a network/offline error, transcribe audio chunks via local backend
    if (fallbackToBackendRef.current || !transcriptRef.current.trim()) {
      setIsTranscribing(true);
      setSttHint("Transcribing audio (local)…");

      // Give recorder 120ms to flush final data chunk
      await new Promise((r) => setTimeout(r, 120));

      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: audioChunksRef.current[0].type || "audio/webm",
        });

        if (audioBlob.size > 1500) {
          try {
            const form = new FormData();
            form.append("file", audioBlob);

            const res = await fetch("/api/transcribe", {
              method: "POST",
              body: form,
            });

            if (res.ok) {
              const data = await res.json();
              if (data.text) {
                onChange((value ? value + " " : "") + data.text);
                setSttHint("Transcribed!");
                setTimeout(() => setSttHint(null), 1500);
              } else {
                setSttHint(null);
              }
            } else {
              const err = await res.json().catch(() => ({}));
              setSttHint(err.error || "Transcription completed.");
              setTimeout(() => setSttHint(null), 3000);
            }
          } catch {
            setSttHint("Local transcription endpoint unavailable.");
            setTimeout(() => setSttHint(null), 3000);
          }
        } else {
          setSttHint(null);
        }
      } else {
        setSttHint(null);
      }
      setIsTranscribing(false);
    } else {
      setSttHint(null);
    }
  }, [value, onChange]);

  // High-sensitivity microphone start
  const startListening = useCallback(async () => {
    transcriptRef.current = "";
    fallbackToBackendRef.current = false;
    audioChunksRef.current = [];

    // 1. Request microphone with AGC (Automatic Gain Control) + Noise Suppression + Echo Cancellation
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      mediaStreamRef.current = stream;
    } catch {
      setSttHint("Microphone access denied. Check browser permissions.");
      setTimeout(() => setSttHint(null), 3500);
      return;
    }

    setIsListening(true);
    setSttHint("Listening… speak clearly.");

    // 2. Setup Web Audio Analyser for live visual hearing meter
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const actx = new AudioCtx();
        audioCtxRef.current = actx;
        const source = actx.createMediaStreamSource(stream);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateMeter = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setMicLevel(Math.min(1, avg / 60)); // High-sensitivity amplification
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };
        updateMeter();
      }
    } catch {
      // Non-fatal if visualizer fails
    }

    // 3. MediaRecorder for local audio backup
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);
    } catch {
      // Non-fatal
    }

    // 4. Browser SpeechRecognition (continuous live stream)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.lang = "en-US";
        rec.interimResults = true;
        rec.continuous = true;
        rec.maxAlternatives = 1;

        const baseValue = value;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (event: any) => {
          let interimText = "";
          let finalText = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) {
              finalText += res[0].transcript + " ";
            } else {
              interimText += res[0].transcript;
            }
          }

          if (finalText) {
            transcriptRef.current += finalText;
            const updated = (baseValue ? baseValue + " " : "") + transcriptRef.current.trim();
            onChange(updated);
          } else if (interimText) {
            const preview = (baseValue ? baseValue + " " : "") + (transcriptRef.current + interimText).trim();
            onChange(preview);
          }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onerror = (event: any) => {
          if (event.error === "network") {
            // Offline mode or Google speech cloud blocked — smoothly switch to local recorder
            fallbackToBackendRef.current = true;
            setSttHint("Offline mode: recording audio for local Whisper…");
          } else if (event.error === "not-allowed") {
            setSttHint("Microphone access blocked.");
            stopListening();
          }
        };

        rec.onend = () => {
          // If still listening and recognition ended, restart if not aborted
          if (isListening && !fallbackToBackendRef.current) {
            try {
              rec.start();
            } catch {
              // ignore
            }
          }
        };

        recognitionRef.current = rec;
        rec.start();
      } catch {
        fallbackToBackendRef.current = true;
      }
    } else {
      fallbackToBackendRef.current = true;
      setSttHint("Recording for local Whisper…");
    }
  }, [value, onChange, isListening, stopListening]);

  const handleVoiceClick = useCallback(() => {
    if (isListening || isTranscribing) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, isTranscribing, startListening, stopListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
      className="relative rounded-2xl border transition-all duration-200"
      style={{
        background: "var(--surface-raised)",
        borderColor: isListening ? "rgba(201,96,63,0.5)" : "var(--border-subtle)",
        boxShadow: isListening
          ? "0 0 15px rgba(201,96,63,0.18)"
          : "0 2px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
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
              {/* Mic Icon button with live hearing volume meter */}
              <button
                type="button"
                onClick={handleVoiceClick}
                className={`relative flex items-center gap-1.5 p-2 rounded-xl transition-all duration-150 cursor-pointer ${
                  isListening
                    ? "bg-red-600 text-white shadow-md"
                    : isTranscribing
                    ? "text-[var(--accent-primary)] bg-[rgba(201,96,63,0.15)] animate-pulse"
                    : "hover:bg-[var(--bg-sidebar-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
                title={
                  isListening
                    ? "Listening… click to finish"
                    : isTranscribing
                    ? "Transcribing audio…"
                    : "Voice input (Dictation)"
                }
              >
                {isTranscribing ? (
                  <svg
                    className="animate-spin"
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : isListening ? (
                  <div className="flex items-center gap-1">
                    <MicIcon size={18} />
                    {/* Live Hearing Volume Meter Bars */}
                    <div className="flex items-center gap-[2px] h-3 px-0.5">
                      <span
                        className="w-[2px] bg-white rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(25, micLevel * 100)}%` }}
                      />
                      <span
                        className="w-[2px] bg-white rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(40, micLevel * 130)}%` }}
                      />
                      <span
                        className="w-[2px] bg-white rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(20, micLevel * 80)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <MicIcon size={18} />
                )}
              </button>

              {/* Waveform Icon button for Read Aloud toggle & playback */}
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
                aria-label={
                  isSpeaking
                    ? "Stop reading aloud"
                    : isReadAloudOn
                    ? "Disable read aloud"
                    : "Enable read aloud"
                }
                aria-pressed={isReadAloudOn}
                title={
                  isSpeaking
                    ? "Stop reading"
                    : isReadAloudOn
                    ? "Read aloud: On"
                    : "Read aloud: Off"
                }
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

