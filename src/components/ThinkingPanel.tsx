"use client";

import React, { useCallback, useState } from "react";
import { ChevronDownIcon } from "./Icons";

/**
 * ThinkingPanel — renders the model's chain-of-thought as a live agent
 * execution log (P0 polish).
 *
 * Shows each reasoning step with a status: done ✓ / running (live spinner) /
 * failed ✗ / interrupted ⏹ / informational ℹ. Tool calls are shown with a
 * shortened query, and search results render as a collapsible summary.
 *
 * UX contract:
 *  - Auto-expands while it is the actively-streaming last group so the user
 *    watches the log build in real time.
 *  - Collapses to a subtle "Thinking…" / "Thought process" summary once the
 *    reply is done (or whenever the user manually collapses it).
 *  - Very long thought bodies are truncated with a "Show more" toggle.
 *
 * The raw reasoning text is NOT altered here — it stays in the message
 * content so localStorage persistence is untouched.
 */

export interface ThinkingItem {
  type: "thought" | "tool_results" | "search" | "step";
  content?: string;
  label?: string;
  items?: Array<{ title: string; url: string; snippet: string }>;
}

interface ThinkingPanelProps {
  /** Non-text blocks belonging to one thought group, in stream order. */
  items: ThinkingItem[];
  /**
   * Whether this message is currently streaming from the backend.
   * isStreaming implies this is precisely the message being produced, so it
   * is the correct "live" signal — the last group in a normal streamed
   * message is the visible answer, not the thought block.
   */
  isStreaming: boolean;
}

type LogStatus = "done" | "running" | "failed" | "interrupted" | "info";

interface LogEntry {
  kind: "tool" | "thinking" | "info" | "results";
  status: LogStatus;
  label?: string;
  params?: string;
  body?: string;
  summary?: string;
  items?: ThinkingItem["items"];
}

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;

/**
 * Convert the parser's raw blocks into ordered log entries with derived
 * statuses. A completed tool (followed by <tool_results>) is "done"; a tool
 * followed by an error step is "failed"; a tool that never resolved is
 * "running" while streaming and "interrupted" once the stream ends.
 */
export function buildThinkingLog(
  items: ThinkingItem[],
  isStreaming: boolean,
): LogEntry[] {
  const entries: LogEntry[] = [];
  const open: LogEntry[] = [];

  const pushTool = (label: string, params?: string) => {
    const entry: LogEntry = { kind: "tool", status: "running", label, params };
    open.push(entry);
    entries.push(entry);
  };

  for (const item of items) {
    if (item.type === "search") {
      pushTool("search_web", item.content?.trim());
      continue;
    }

    if (item.type === "tool_results") {
      const last = open.pop();
      if (last) last.status = "done";
      const n = item.items?.length ?? 0;
      entries.push({
        kind: "results",
        status: "done",
        label: item.label || "tool",
        summary: `${n} result${n === 1 ? "" : "s"}`,
        items: item.items,
      });
      continue;
    }

    if (item.type === "step") {
      const content = (item.content ?? "").trim();

      // Tool start — the workhorse of the web-search turn.
      const toolMatch = content.match(/Using\s+([\w_]+)\s+for\s+"([^"]*)"/i);
      if (toolMatch) {
        pushTool(toolMatch[1], toolMatch[2]);
        continue;
      }

      if (/encountered an issue/i.test(content) && open.length > 0) {
        const entry = open.pop()!;
        entry.status = "failed";
        entries.push({ kind: "info", status: "info", body: content });
        continue;
      }

      if (/reconnected to backend/i.test(content)) {
        entries.push({ kind: "info", status: "info", body: "Backend connection restored." });
        continue;
      }

      if (/connection lost/i.test(content)) {
        entries.push({ kind: "info", status: "info", body: content });
        continue;
      }

      if (/failed to write a visible response|stopped unexpectedly/i.test(content)) {
        entries.push({ kind: "info", status: "failed", body: content });
        continue;
      }

      if (open.length === 0 && /unknown action/i.test(content)) {
        entries.push({ kind: "info", status: "failed", body: content });
        continue;
      }

      // Generic narration (unclosed action, status copy, etc.).
      entries.push({ kind: "info", status: "info", body: content });
      continue;
    }

    if (item.type === "thought") {
      const body = (item.content ?? "").trim();
      if (body) {
        entries.push({ kind: "thinking", status: "done", body });
      }
    }
  }

  // Tools that never resolved: keep "running" while streaming (still live),
  // otherwise mark them interrupted — the stream ended without a result.
  if (isStreaming) {
    for (const entry of open) entry.status = "running";
  } else {
    for (const entry of open) entry.status = "interrupted";
  }

  return entries;
}

const TRUNCATE_LOG_NOTE = 280;

function StatusGlyph({ status }: { status: LogStatus }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-[var(--accent-primary)]">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="text-emerald-500">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="text-red-400">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  if (status === "interrupted") {
    return (
      <span className="text-[var(--text-secondary)]">
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
          <rect x="4" y="4" width="2.4" height="8" rx="0.6" />
          <rect x="9.6" y="4" width="2.4" height="8" rx="0.6" />
        </svg>
      </span>
    );
  }
  return (
    <span className="text-[var(--text-secondary)] opacity-70">
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 5v4M8 11.4v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function ThoughtBody({ body, isStreaming }: { body: string; isStreaming: boolean }) {
  const [showMore, setShowMore] = useState(false);
  const isLong = body.length > TRUNCATE_LOG_NOTE;

  // While streaming, don't hide the tail — it's still growing.
  const display = !isLong || isStreaming || showMore ? body : truncate(body, TRUNCATE_LOG_NOTE);

  return (
    <div>
      <div className="whitespace-pre-wrap leading-relaxed break-words text-[var(--text-secondary)] opacity-90 pl-4 text-[0.95em]">
        {display}
      </div>
      {isLong && !isStreaming && (
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="ml-4 mt-1 text-xs-ui text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] opacity-80 cursor-pointer"
        >
          {showMore ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ResultList({
  items,
}: {
  items: NonNullable<ThinkingItem["items"]>;
}) {
  return (
    <ul className="mt-1 ml-6 space-y-1.5 border-l-[2px] border-[var(--border-subtle)] pl-3">
      {items.map((res, i) => (
        <li key={i}>
          <a
            href={res.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <span className="block font-medium text-[var(--text-primary)]">{res.title}</span>
            {res.snippet && <span className="block opacity-80">{res.snippet}</span>}
            {res.url && <span className="block text-xs opacity-60 break-all">{res.url}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ThinkingPanel({ items, isStreaming }: ThinkingPanelProps) {
  // null = not set by the user yet → follows the "live" default.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const [resultsOpen, setResultsOpen] = useState<Record<number, boolean>>({});

  const entries = buildThinkingLog(items, isStreaming);
  if (entries.length === 0) return null;

  const live = isStreaming;
  const isExpanded = userOpen ?? live;

  const doneCount = entries.filter((e) => e.status === "done").length;
  const failedCount = entries.filter((e) => e.status === "failed" || e.status === "interrupted").length;
  const hasInterrupted = entries.some((e) => e.status === "interrupted");

  const handleToggle = useCallback((e: React.SyntheticEvent<HTMLDetailsElement>) => {
    setUserOpen(e.currentTarget.open);
  }, []);

  const toggleResults = useCallback((idx: number, open: boolean) => {
    setResultsOpen((prev) => ({ ...prev, [idx]: open }));
  }, []);

  return (
    <details
      className="mb-4 text-sm-ui group"
      open={isExpanded}
      onToggle={handleToggle}
    >
      <summary className="inline-flex items-center gap-2 cursor-pointer select-none outline-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 list-none [&::-webkit-details-marker]:hidden">
        <ChevronDownIcon
          size={13}
          className="opacity-50 transition-transform duration-200 group-open:rotate-180"
        />
        {live ? (
          <span className="inline-flex items-center gap-2 font-medium text-[var(--accent-primary)]">
            <span className="typing-indicator">
              <span />
              <span />
              <span />
            </span>
            Thinking…
          </span>
        ) : (
          <span className="font-medium">Thought process</span>
        )}
        {!live && doneCount > 0 && (
          <span className="text-xs opacity-60 text-[var(--text-secondary)]">
            · {doneCount} step{doneCount === 1 ? "" : "s"}
          </span>
        )}
        {!live && failedCount > 0 && (
          <span className="text-xs opacity-80 text-red-400">
            · {failedCount} issue{failedCount === 1 ? "" : "s"}
          </span>
        )}
      </summary>

      <div className="mt-3 ml-1 border-l-[2px] border-[var(--border-subtle)] space-y-2.5 pl-2">
        {entries.map((entry, idx) => {
          if (entry.kind === "tool") {
            return (
              <div key={idx} className="flex items-baseline gap-2">
                <span className="flex-shrink-0 mt-1">
                  <StatusGlyph status={entry.status} />
                </span>
                <span className="font-medium text-[var(--text-primary)] opacity-90 font-mono text-sm">
                  {entry.label}
                </span>
                {entry.params && (
                  <span className="text-[var(--text-secondary)] opacity-80 break-words min-w-0 text-[0.92em]">
                    “{truncate(entry.params, 90)}”
                  </span>
                )}
              </div>
            );
          }

          if (entry.kind === "results") {
            const openState = resultsOpen[idx] ?? false;
            const results = entry.items ?? [];
            return (
              <details
                key={idx}
                className="pl-2 text-sm-ui group/results"
                open={openState}
                onToggle={(e) => toggleResults(idx, e.currentTarget.open)}
              >
                <summary className="inline-flex items-center gap-2 cursor-pointer select-none outline-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 list-none [&::-webkit-details-marker]:hidden">
                  <ChevronDownIcon
                    size={11}
                    className="transition-transform duration-200 group-open/results:rotate-180"
                  />
                  <span className="font-medium">{entry.summary || "Search results"}</span>
                </summary>
                {results.length > 0 && <ResultList items={results} />}
              </details>
            );
          }

          if (entry.kind === "thinking") {
            return <ThoughtBody key={idx} body={entry.body ?? ""} isStreaming={live} />;
          }

          // info
          return (
            <div key={idx} className="flex items-baseline gap-2">
              <span className="flex-shrink-0 mt-1">
                <StatusGlyph status={entry.status} />
              </span>
              <span className="text-[var(--text-secondary)] opacity-85 text-[0.92em] break-words min-w-0">
                {entry.body}
              </span>
            </div>
          );
        })}

        {hasInterrupted && (
          <div className="pt-1 text-xs-ui italic text-[var(--text-secondary)] opacity-70">
            Generation was stopped — the log may be incomplete.
          </div>
        )}
      </div>
    </details>
  );
}