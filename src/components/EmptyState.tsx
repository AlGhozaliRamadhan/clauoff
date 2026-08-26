"use client";

import React from "react";
import { CogitoMark } from "./CogitoBrand";

interface EmptyStateProps {
  onSuggestionClick?: (text: string) => void;
  composer?: React.ReactNode;
}

/**
 * Empty state greeting shown when no messages exist.
 * Matches the reference screenshot: large serif greeting with logo mark,
 * plus quick-action pill buttons below the composer.
 */
export function EmptyState({ onSuggestionClick, composer }: EmptyStateProps) {
  const [nickname, setNickname] = React.useState("oza");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cogito.nickname.v1");
      if (stored) setNickname(stored);

      const handleUpdate = () => {
        const updated = localStorage.getItem("cogito.nickname.v1");
        if (updated) setNickname(updated);
      };
      window.addEventListener("cogito-nickname-changed", handleUpdate);
      return () => window.removeEventListener("cogito-nickname-changed", handleUpdate);
    }
  }, []);

  // Get time-based greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? `Morning, ${nickname}` : hour < 18 ? `Afternoon, ${nickname}` : `Evening, ${nickname}`;

  const suggestions = [
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" className="text-[var(--text-secondary)]">
          <path d="M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z" />
        </svg>
      ),
      label: "Write",
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" className="text-[var(--text-secondary)]">
          <path d="M251.76,88.94l-120-64a8,8,0,0,0-7.52,0l-120,64a8,8,0,0,0,0,14.12L32,117.87v48.42a15.91,15.91,0,0,0,4.06,10.65C49.16,191.53,78.51,216,128,216a130,130,0,0,0,48-8.76V240a8,8,0,0,0,16,0V199.51a115.63,115.63,0,0,0,27.94-22.57A15.91,15.91,0,0,0,224,166.29V117.87l27.76-14.81a8,8,0,0,0,0-14.12ZM128,200c-43.27,0-68.72-21.14-80-33.71V126.4l76.24,40.66a8,8,0,0,0,7.52,0L176,143.47v46.34C163.4,195.69,147.52,200,128,200Zm80-33.75a97.83,97.83,0,0,1-16,14.25V134.93l16-8.53ZM188,118.94l-.22-.13-56-29.87a8,8,0,0,0-7.52,14.12L171,128l-43,22.93L25,96,128,41.07,231,96Z" />
        </svg>
      ),
      label: "Learn",
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" className="text-[var(--text-secondary)]">
          <path d="M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.3ZM176,121.85a8,8,0,1,0-10.24,12.3L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z" />
        </svg>
      ),
      label: "Code",
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" className="text-[var(--text-secondary)]">
          <path d="M80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm40,8a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,120,64Zm32,0a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,152,64Zm96,56v8a40,40,0,0,1-37.51,39.91,96.59,96.59,0,0,1-27,40.09H208a8,8,0,0,1,0,16H32a8,8,0,0,1,0-16H56.54A96.3,96.3,0,0,1,24,136V88a8,8,0,0,1,8-8H208A40,40,0,0,1,248,120ZM200,96H40v40a80.27,80.27,0,0,0,45.12,72h69.76A80.27,80.27,0,0,0,200,136Zm32,24a24,24,0,0,0-16-22.62V136a95.78,95.78,0,0,1-1.2,15A24,24,0,0,0,232,128Z" />
        </svg>
      ),
      label: "Life stuff",
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 256 256" className="text-[var(--text-secondary)]">
          <path d="M176,232a8,8,0,0,1-8,8H88a8,8,0,0,1,0-16h80A8,8,0,0,1,176,232Zm40-128a87.55,87.55,0,0,1-33.64,69.21A16.24,16.24,0,0,0,176,186v6a16,16,0,0,1-16,16H96a16,16,0,0,1-16-16v-6a16,16,0,0,0-6.23-12.66A87.59,87.59,0,0,1,40,104.49C39.74,56.83,78.26,17.14,125.88,16A88,88,0,0,1,216,104Zm-16,0a72,72,0,0,0-73.74-72c-39,.92-70.47,33.39-70.26,72.39a71.65,71.65,0,0,0,27.64,56.3A32,32,0,0,1,96,186v6h64v-6a32.15,32.15,0,0,1,12.47-25.35A71.65,71.65,0,0,0,200,104Zm-16.11-9.34a57.6,57.6,0,0,0-46.56-46.55,8,8,0,0,0-2.66,15.78c16.57,2.79,30.63,16.85,33.44,33.45A8,8,0,0,0,176,104a9,9,0,0,0,1.35-.11A8,8,0,0,0,183.89,94.66Z" />
        </svg>
      ),
      label: "Cogito's choice",
    },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full px-4 py-6 overflow-y-auto">
      <div className="w-full max-w-[680px] flex flex-col items-center -mt-8 sm:-mt-14">
        {/* Greeting */}
        <div className="flex items-center gap-2.5 mb-5">
          <CogitoMark size={28} className="opacity-95 flex-shrink-0" />
          <h1
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--text-primary)",
              fontWeight: 400,
              lineHeight: 1.2,
              fontSize: "1.85rem",
            }}
          >
            {greeting}
          </h1>
        </div>

        {/* Composer container (rendered in the center) */}
        {composer && (
          <div className="w-full mb-5">
            {composer}
          </div>
        )}

        {/* Suggestion pills */}
        <div className="flex flex-wrap gap-2 justify-center w-full">
          {suggestions.map((s) => (
            <button
              key={s.label}
              onClick={() => onSuggestionClick?.(s.label)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border transition-all duration-150 cursor-pointer hover:bg-[var(--surface-hover)] bg-[var(--surface-raised)] hover:border-[var(--border-strong)] shadow-xs"
              style={{
                borderColor: "var(--border-subtle)",
                fontFamily: "var(--font-ui)",
                fontSize: "var(--text-xs)",
                color: "var(--text-primary)",
              }}
            >
              <span>{s.icon}</span>
              <span className="font-normal">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
