"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  type VoiceSettings,
  type VoiceOption,
  DEFAULT_VOICE_SETTINGS,
  AVAILABLE_VOICES,
} from "@/lib/audio/types";
import { cleanTextForSpeech, splitTextIntoSpeechChunks } from "@/lib/audio/text-cleaner";

interface AudioContextValue {
  isPlaying: boolean;
  isGenerating: boolean;
  activeId: string | null;
  voiceSettings: VoiceSettings;
  availableVoices: VoiceOption[];
  updateVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  playVoice: (text: string, id?: string) => Promise<void>;
  stopVoice: () => void;
  toggleVoice: (text: string, id?: string) => Promise<void>;
  enqueueVoiceChunk: (chunk: string, streamId: string) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

interface QueuedChunk {
  streamId: string;
  fetchPromise: Promise<Blob | null>;
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>(AVAILABLE_VOICES);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  const activeControllersRef = useRef<Set<AbortController>>(new Set());
  const queueRef = useRef<QueuedChunk[]>([]);
  const isProcessingQueueRef = useRef(false);
  const activeStreamIdRef = useRef<string | null>(null);
  const activeUtterancesRef = useRef<Set<SpeechSynthesisUtterance>>(new Set());
  const systemVoicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Load browser speech synthesis voices eagerly
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        systemVoicesRef.current = v;
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Load voice settings from localStorage on client mount (prevents SSR hydration mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("cogito.voice.settings.v2");
      if (stored) {
        setVoiceSettings({ ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(stored) });
      }
    } catch {
      // Fallback to default
    }
  }, []);

  // Fetch available voices from backend
  useEffect(() => {
    fetch("/api/voice")
      .then((r) => r.json())
      .then((data) => {
        if (data.voices && Array.isArray(data.voices)) {
          setAvailableVoices(data.voices);
        }
      })
      .catch(() => {});
  }, []);

  const updateVoiceSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setVoiceSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("cogito.voice.settings.v2", JSON.stringify(updated));
        } catch (e) {
          console.warn("Failed to save voice settings:", e);
        }
      }
      return updated;
    });
  }, []);

  const stopVoice = useCallback(() => {
    // Abort all active fetch controllers
    if (activeControllersRef.current.size > 0) {
      activeControllersRef.current.forEach((ctrl) => {
        try {
          ctrl.abort();
        } catch {
          // ignore
        }
      });
      activeControllersRef.current.clear();
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      activeUtterancesRef.current.clear();
    }

    queueRef.current = [];
    isProcessingQueueRef.current = false;
    activeStreamIdRef.current = null;

    if (audioRef.current) {
      const audio = audioRef.current;
      audioRef.current = null;

      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      audio.onpause = null;

      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
    }

    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }

    setIsPlaying(false);
    setIsGenerating(false);
    setActiveId(null);
  }, []);

  const processNextChunk = useCallback(async () => {
    if (queueRef.current.length === 0) {
      isProcessingQueueRef.current = false;
      setIsGenerating(false);
      setIsPlaying(false);
      setActiveId(null);
      activeStreamIdRef.current = null;
      return;
    }

    isProcessingQueueRef.current = true;

    const nextItem = queueRef.current.shift();
    if (!nextItem) {
      isProcessingQueueRef.current = false;
      setIsGenerating(false);
      setIsPlaying(false);
      setActiveId(null);
      activeStreamIdRef.current = null;
      return;
    }

    try {
      const blob = await nextItem.fetchPromise;
      if (!blob || activeStreamIdRef.current !== nextItem.streamId) {
        // Stream was cancelled or fetch failed, move to next if still valid stream
        if (activeStreamIdRef.current === nextItem.streamId) {
          processNextChunk();
        }
        return;
      }

      if (activeUrlRef.current) {
        URL.revokeObjectURL(activeUrlRef.current);
      }
      const audioUrl = URL.createObjectURL(blob);
      activeUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audio.volume = voiceSettings.volume ?? 0.70;
      audioRef.current = audio;

      audio.onplay = () => {
        setIsGenerating(false);
        setIsPlaying(true);
      };

      audio.onended = () => {
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
        audio.removeAttribute("src");
        audioRef.current = null;
        if (activeUrlRef.current) {
          URL.revokeObjectURL(activeUrlRef.current);
          activeUrlRef.current = null;
        }
        processNextChunk();
      };

      audio.onerror = () => {
        audio.onplay = null;
        audio.onended = null;
        audio.onerror = null;
        audio.removeAttribute("src");
        audioRef.current = null;
        if (activeUrlRef.current) {
          URL.revokeObjectURL(activeUrlRef.current);
          activeUrlRef.current = null;
        }
        processNextChunk();
      };

      await audio.play().catch(() => {
        processNextChunk();
      });
    } catch {
      processNextChunk();
    }
  }, [voiceSettings.volume]);

  const fetchChunkAudio = useCallback(
    (textChunk: string, controller: AbortController): Promise<Blob | null> => {
      activeControllersRef.current.add(controller);
      return fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textChunk,
          voice: voiceSettings.voiceId || "am_adam",
          speed: voiceSettings.speed ?? 0.85,
          fx: voiceSettings.fxEnabled ?? true,
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return null;
          return await res.blob();
        })
        .catch((err) => {
          if (err?.name !== "AbortError") {
            console.warn("Chunk TTS fetch error:", err);
          }
          return null;
        })
        .finally(() => {
          activeControllersRef.current.delete(controller);
        });
    },
    [voiceSettings.voiceId, voiceSettings.speed, voiceSettings.fxEnabled],
  );

  const enqueueVoiceChunk = useCallback(
    (chunk: string, streamId: string) => {
      const clean = cleanTextForSpeech(chunk);
      if (!clean || !clean.trim()) return;

      // Instant browser speech synthesis engine (< 15ms latency)
      if (voiceSettings.engine !== "neural") {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }

          if (activeStreamIdRef.current !== streamId) {
            window.speechSynthesis.cancel();
            activeUtterancesRef.current.clear();
            activeStreamIdRef.current = streamId;
            setActiveId(streamId);
          }

          const utterance = new SpeechSynthesisUtterance(clean);
          utterance.rate = (voiceSettings.speed ?? 0.85) * 1.05;
          utterance.volume = voiceSettings.volume ?? 0.70;

          const voices = systemVoicesRef.current.length > 0 ? systemVoicesRef.current : window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            const isFemale = voiceSettings.voiceId.startsWith("af");
            const isBritish = voiceSettings.voiceId.startsWith("bm");
            const matched = voices.find(v => 
              v.lang.startsWith("en") && 
              (isBritish ? (v.lang.includes("GB") || v.lang.includes("UK")) : true) &&
              (isFemale 
                ? (v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("samantha") || v.name.toLowerCase().includes("jenny"))
                : (v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("george") || v.name.toLowerCase().includes("guy")))
            ) || voices.find(v => v.lang.startsWith("en")) || voices[0];

            if (matched) utterance.voice = matched;
          }

          activeUtterancesRef.current.add(utterance);

          utterance.onstart = () => {
            setIsGenerating(false);
            setIsPlaying(true);
          };
          const handleEnd = () => {
            activeUtterancesRef.current.delete(utterance);
            if (activeUtterancesRef.current.size === 0 && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
              setIsPlaying(false);
              setIsGenerating(false);
              setActiveId(null);
              activeStreamIdRef.current = null;
            }
          };
          utterance.onend = handleEnd;
          utterance.onerror = handleEnd;

          setIsGenerating(true);
          window.speechSynthesis.speak(utterance);

          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          return;
        }
      }

      // Neural Kokoro server engine
      if (activeStreamIdRef.current !== streamId) {
        stopVoice();
        activeStreamIdRef.current = streamId;
        setActiveId(streamId);
      }

      setIsGenerating(true);
      const controller = new AbortController();
      const fetchPromise = fetchChunkAudio(clean, controller);

      queueRef.current.push({ streamId, fetchPromise });

      if (!isProcessingQueueRef.current) {
        processNextChunk();
      }
    },
    [voiceSettings, stopVoice, fetchChunkAudio, processNextChunk],
  );

  const playVoice = useCallback(
    async (text: string, id: string = "default") => {
      // If already playing this ID, toggle off (stop)
      if (isPlaying && activeId === id) {
        stopVoice();
        return;
      }

      // Stop any current playback
      stopVoice();

      const chunks = splitTextIntoSpeechChunks(text);
      if (chunks.length === 0) {
        return;
      }

      setActiveId(id);
      activeStreamIdRef.current = id;
      setIsGenerating(true);

      // Instant browser speech synthesis (< 15ms latency)
      if (voiceSettings.engine !== "neural") {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }

          const voices = systemVoicesRef.current.length > 0 ? systemVoicesRef.current : window.speechSynthesis.getVoices();
          const isFemale = voiceSettings.voiceId.startsWith("af");
          const isBritish = voiceSettings.voiceId.startsWith("bm");
          const matchedVoice = voices.length > 0
            ? (voices.find(v => 
                v.lang.startsWith("en") && 
                (isBritish ? (v.lang.includes("GB") || v.lang.includes("UK")) : true) &&
                (isFemale 
                  ? (v.name.toLowerCase().includes("female") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("samantha") || v.name.toLowerCase().includes("jenny"))
                  : (v.name.toLowerCase().includes("male") || v.name.toLowerCase().includes("david") || v.name.toLowerCase().includes("george") || v.name.toLowerCase().includes("guy")))
              ) || voices.find(v => v.lang.startsWith("en")) || voices[0])
            : undefined;

          chunks.forEach((chunk) => {
            const utterance = new SpeechSynthesisUtterance(chunk);
            utterance.rate = (voiceSettings.speed ?? 0.85) * 1.05;
            utterance.volume = voiceSettings.volume ?? 0.70;
            if (matchedVoice) utterance.voice = matchedVoice;

            activeUtterancesRef.current.add(utterance);

            utterance.onstart = () => {
              setIsGenerating(false);
              setIsPlaying(true);
            };

            const handleEnd = () => {
              activeUtterancesRef.current.delete(utterance);
              if (activeUtterancesRef.current.size === 0 && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                setIsPlaying(false);
                setIsGenerating(false);
                setActiveId(null);
                activeStreamIdRef.current = null;
              }
            };
            utterance.onend = handleEnd;
            utterance.onerror = handleEnd;

            window.speechSynthesis.speak(utterance);
          });

          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          return;
        }
      }

      // Neural Kokoro server engine: pipeline chunks for immediate playback onset
      // First chunk starts fetching immediately; subsequent chunks prefetch concurrently
      for (const chunk of chunks) {
        const controller = new AbortController();
        const fetchPromise = fetchChunkAudio(chunk, controller);
        queueRef.current.push({ streamId: id, fetchPromise });
      }

      // Start queue playback immediately as soon as Chunk 0 audio blob lands
      processNextChunk();
    },
    [isPlaying, activeId, voiceSettings, stopVoice, fetchChunkAudio, processNextChunk],
  );

  const toggleVoice = useCallback(
    async (text: string, id: string = "default") => {
      if (isPlaying && activeId === id) {
        stopVoice();
      } else {
        await playVoice(text, id);
      }
    },
    [isPlaying, activeId, playVoice, stopVoice],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, [stopVoice]);

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        isGenerating,
        activeId,
        voiceSettings,
        availableVoices,
        updateVoiceSettings,
        playVoice,
        stopVoice,
        toggleVoice,
        enqueueVoiceChunk,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}




export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return ctx;
}
