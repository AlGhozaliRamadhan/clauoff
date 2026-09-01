"use client";

import React, { useState } from "react";
import type { SourceCitation } from "@/lib/rag/types";

interface SourceChipsProps {
  sources: SourceCitation[];
}

/**
 * Citation chips under an assistant message (ADR-0005 / DESIGN_SYSTEM).
 * Pill shape, secondary text, hairline border; tooltip = snippet.
 */
export function SourceChips({ sources }: SourceChipsProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!sources?.length) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s) => (
          <button
            key={s.n}
            type="button"
            title={s.snippet}
            onClick={() =>
              setExpanded((prev) => (prev === s.n ? null : s.n))
            }
            className="px-2 py-0.5 rounded-full cursor-pointer transition-colors duration-150 hover:bg-[var(--border-subtle)]"
            style={{
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-ui)",
              fontSize: "var(--text-xs)",
              lineHeight: "1.4",
              background:
                expanded === s.n
                  ? "var(--border-subtle)"
                  : "transparent",
            }}
          >
            [{s.n}] {s.filename}
          </button>
        ))}
      </div>
      {expanded !== null && (
        <div
          className="rounded-lg px-3 py-2 text-[12px]"
          style={{
            background: "var(--surface-raised, var(--border-subtle))",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-ui)",
            border: "1px solid var(--border-subtle)",
            maxWidth: "100%",
          }}
        >
          {sources.find((s) => s.n === expanded)?.snippet}
        </div>
      )}
    </div>
  );
}
