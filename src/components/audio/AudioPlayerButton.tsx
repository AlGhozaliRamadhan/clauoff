"use client";

import React from "react";
import { useAudio } from "@/contexts/AudioContext";
import { SpeakerWaveIcon, SpeakerStopIcon } from "@/components/ui/Icons";

interface AudioPlayerButtonProps {
  text: string;
  id: string;
  className?: string;
  size?: number;
  showLabel?: boolean;
}

export function AudioPlayerButton({
  text,
  id,
  className = "",
  size = 16,
  showLabel = false,
}: AudioPlayerButtonProps) {
  const { isPlaying, isGenerating, activeId, toggleVoice } = useAudio();

  const isCurrentActive = activeId === id;
  const isThisGenerating = isGenerating && isCurrentActive;
  const isThisPlaying = isPlaying && isCurrentActive;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleVoice(text, id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isGenerating && !isCurrentActive}
      className={`relative inline-flex items-center gap-1.5 p-1 rounded transition-colors cursor-pointer disabled:opacity-40 ${
        isThisPlaying
          ? "text-[var(--accent-primary)] bg-[rgba(201,96,63,0.12)] hover:bg-[rgba(201,96,63,0.18)]"
          : isThisGenerating
          ? "text-[var(--accent-primary)] animate-pulse hover:bg-[var(--surface-hover)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
      } ${className}`}
      title={
        isThisPlaying
          ? "Stop reading"
          : isThisGenerating
          ? "Synthesizing..."
          : "Read aloud"
      }
      aria-label={isThisPlaying ? "Stop voice" : "Read aloud"}
    >
      {isThisGenerating ? (
        <svg
          className="animate-spin"
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : isThisPlaying ? (
        <div className="flex items-center gap-1">
          {/* Animated sound bars */}
          <div className="flex items-center gap-[2px] h-3 px-0.5">
            <span className="w-[2px] h-full bg-[var(--accent-primary)] animate-[pulse_0.6s_ease-in-out_infinite_alternate]" />
            <span className="w-[2px] h-[60%] bg-[var(--accent-primary)] animate-[pulse_0.8s_ease-in-out_infinite_alternate_0.2s]" />
            <span className="w-[2px] h-[90%] bg-[var(--accent-primary)] animate-[pulse_0.7s_ease-in-out_infinite_alternate_0.4s]" />
          </div>
          <SpeakerStopIcon size={size} />
        </div>
      ) : (
        <SpeakerWaveIcon size={size} />
      )}

      {showLabel && (
        <span className="text-xs font-medium">
          {isThisPlaying ? "Stop" : isThisGenerating ? "Generating..." : "Read aloud"}
        </span>
      )}
    </button>
  );
}
