"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getVoiceSessionHint,
  type VoiceSessionStatus,
  type VoiceSessionUiState,
} from "@/lib/audio/voice-session";
import type { MicVAD } from "@ricky0123/vad-web";

interface UseVoiceSessionOptions {
  isAssistantStreaming: boolean;
  isAssistantSpeaking: boolean;
  onInterrupt: () => void;
  onTranscript: (text: string) => boolean | Promise<boolean>;
}

interface TranscriptionResponse {
  text?: string;
  error?: string;
}

export function useVoiceSession({
  isAssistantStreaming,
  isAssistantSpeaking,
  onInterrupt,
  onTranscript,
}: UseVoiceSessionOptions): VoiceSessionUiState {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<VoiceSessionStatus>("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [modelPreparing, setModelPreparing] = useState(false);

  const vadRef = useRef<MicVAD | null>(null);
  const enabledRef = useRef(false);
  const speechActiveRef = useRef(false);
  const transcribingRef = useRef(false);
  const operationRef = useRef(0);
  const lastLevelUpdateRef = useRef(0);
  const assistantBusyRef = useRef(false);
  const onInterruptRef = useRef(onInterrupt);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    assistantBusyRef.current = isAssistantStreaming || isAssistantSpeaking;
    onInterruptRef.current = onInterrupt;
    onTranscriptRef.current = onTranscript;
  }, [isAssistantSpeaking, isAssistantStreaming, onInterrupt, onTranscript]);

  const warmLocalModels = useCallback(() => {
    setModelPreparing(true);
    void fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "warmup" }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Local speech recognition could not be prepared.");
        }
      })
      .catch((warmupError: unknown) => {
        // The actual transcription request will retry and surface a useful error.
        console.warn("Local speech warmup failed:", warmupError);
      })
      .finally(() => setModelPreparing(false));
  }, []);

  const transcribe = useCallback(async (audio: Float32Array) => {
    if (!enabledRef.current || transcribingRef.current) return;
    transcribingRef.current = true;
    speechActiveRef.current = false;
    setLevel(0);
    setStatus("transcribing");

    try {
      const payload = audio.slice();
      const form = new FormData();
      form.append(
        "file",
        new Blob([payload.buffer as ArrayBuffer], { type: "application/x-cogito-f32le" }),
        "speech.f32",
      );
      form.append("engine", "local");
      form.append("format", "f32le");
      form.append("sampleRate", "16000");
      form.append("language", navigator.language || "auto");

      const response = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = (await response.json().catch(() => ({}))) as TranscriptionResponse;
      if (!response.ok) {
        throw new Error(data.error || "Local transcription failed.");
      }

      const text = data.text?.trim() || "";
      if (!text) throw new Error("I couldn't hear a clear spoken phrase.");
      if (!enabledRef.current) return;
      setLastTranscript(text);
      setStatus("listening");
      const accepted = await onTranscriptRef.current(text);
      if (!accepted) {
        throw new Error("Cogito is still finishing the previous turn. Please say that again.");
      }
    } catch (transcriptionError: unknown) {
      const message = transcriptionError instanceof Error
        ? transcriptionError.message
        : "Local transcription failed.";
      setError(message);
      setStatus("error");
      window.setTimeout(() => {
        if (enabledRef.current) {
          setError(null);
          setStatus("listening");
        }
      }, 2600);
    } finally {
      transcribingRef.current = false;
    }
  }, []);

  const stop = useCallback(async () => {
    operationRef.current += 1;
    enabledRef.current = false;
    speechActiveRef.current = false;
    transcribingRef.current = false;
    setEnabled(false);
    setStatus("idle");
    setLevel(0);
    setError(null);
    const vad = vadRef.current;
    if (vad?.listening) {
      await vad.pause().catch(() => {});
    }
  }, []);

  const start = useCallback(async () => {
    if (enabledRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot access a microphone.");
      setStatus("error");
      return;
    }

    const operation = ++operationRef.current;
    enabledRef.current = true;
    setEnabled(true);
    setError(null);
    setStatus("preparing");
    warmLocalModels();

    try {
      let vad = vadRef.current;
      if (!vad || vad.errored) {
        if (vad) await vad.destroy().catch(() => {});
        const { MicVAD } = await import("@ricky0123/vad-web");
        vad = await MicVAD.new({
          model: "v5",
          startOnLoad: false,
          processorType: "auto",
          baseAssetPath: "/vendor/vad/",
          onnxWASMBasePath: "/vendor/vad/",
          positiveSpeechThreshold: 0.62,
          negativeSpeechThreshold: 0.42,
          redemptionMs: 800,
          preSpeechPadMs: 300,
          minSpeechMs: 320,
          submitUserSpeechOnPause: false,
          getStream: () => navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          }),
          onFrameProcessed: (_probabilities, frame) => {
            const now = performance.now();
            if (now - lastLevelUpdateRef.current < 80) return;
            lastLevelUpdateRef.current = now;
            let sum = 0;
            for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
            setLevel(Math.min(1, Math.sqrt(sum / frame.length) * 9));
          },
          onSpeechStart: () => {
            if (!enabledRef.current || transcribingRef.current) return;
            speechActiveRef.current = true;
            setStatus("hearing");
          },
          onSpeechRealStart: () => {
            if (enabledRef.current && assistantBusyRef.current) {
              onInterruptRef.current();
            }
          },
          onVADMisfire: () => {
            speechActiveRef.current = false;
            if (enabledRef.current && !transcribingRef.current) setStatus("listening");
          },
          onSpeechEnd: (speech) => {
            void transcribe(speech);
          },
        });
        vadRef.current = vad;
      }

      if (operation !== operationRef.current || !enabledRef.current) {
        return;
      }

      await vad.start();
      if (vad.errored) throw new Error(vad.errored);
      if (operation !== operationRef.current || !enabledRef.current) {
        if (vad.listening) await vad.pause().catch(() => {});
        return;
      }
      if (operation === operationRef.current && enabledRef.current) {
        setStatus("listening");
      }
    } catch (startError: unknown) {
      enabledRef.current = false;
      setEnabled(false);
      setLevel(0);
      const message = startError instanceof Error
        ? startError.message
        : "Voice mode could not access the microphone.";
      setError(message);
      setStatus("error");
      const vad = vadRef.current;
      vadRef.current = null;
      if (vad) await vad.destroy().catch(() => {});
    }
  }, [transcribe, warmLocalModels]);

  const toggle = useCallback(async () => {
    if (enabledRef.current) await stop();
    else await start();
  }, [start, stop]);

  useEffect(() => {
    const vad = vadRef.current;
    if (!vad || !enabled) return;
    vad.setOptions(isAssistantSpeaking
      ? { positiveSpeechThreshold: 0.78, negativeSpeechThreshold: 0.55 }
      : { positiveSpeechThreshold: 0.62, negativeSpeechThreshold: 0.42 });
  }, [enabled, isAssistantSpeaking]);

  useEffect(() => {
    return () => {
      operationRef.current += 1;
      enabledRef.current = false;
      const vad = vadRef.current;
      vadRef.current = null;
      if (vad) void vad.destroy().catch(() => {});
    };
  }, []);

  const displayStatus: VoiceSessionStatus = !enabled
    ? status
    : status === "preparing" || status === "hearing" || status === "transcribing" || status === "error"
      ? status
      : isAssistantSpeaking
        ? "speaking"
        : isAssistantStreaming
          ? "thinking"
          : "listening";

  const hint = useMemo(
    () => getVoiceSessionHint(displayStatus, modelPreparing, error),
    [displayStatus, error, modelPreparing],
  );

  return { enabled, status: displayStatus, level, hint, error, lastTranscript, toggle, stop };
}
