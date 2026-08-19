"use client";

import React, { useState, useCallback } from "react";
import { CogitoMark } from "./CogitoBrand";
import { CopyIcon, CheckIcon, ChevronDownIcon, SearchIcon } from "./Icons";
import { SourceChips } from "./SourceChips";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { SourceCitation } from "@/lib/rag/types";

interface MessageAssistantProps {
  content: string;
  isStreaming?: boolean;
  sources?: SourceCitation[];
  onRetry?: () => void;
}

interface ToolResultsItem {
  title: string;
  url: string;
  snippet: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Assistant message — bare text (no bubble), full column width.
 * Per DESIGN_SYSTEM.md: assistant turns have no bubble, just bare text with
 * a small round avatar mark to the left of the first line only.
 *
 * For now (Phase 3), renders plain text. Phase 4 will add react-markdown.
 * Source chips (ADR-0005) render under the body when citations are present.
 */
export function MessageAssistant({
  content,
  isStreaming = false,
  sources,
  onRetry,
}: MessageAssistantProps) {
  const [copied, setCopied] = useState(false);

  
  const blocks: { type: "text" | "thought" | "tool_results" | "search" | "step"; content?: string; label?: string; items?: ToolResultsItem[] }[] = [];
  
  let remaining = content;

  // Clean out things we never want to show
  const stripInternal = (raw: string): string =>
    raw
      .replace(/<confidence>[\s\S]*?<\/confidence>\s*/gi, "")
      .replace(/<action[^>]*>[\s\S]*?<\/action>\s*/gi, "")
      .replace(/<\/?\s*(?:\|)?(?:thought|think)\b[^>]*>/gi, "")
      .replace(/<step(?:>|\s[^>]*>)/gi, "")
      .replace(/<\/step>/gi, "")
      .replace(/<verification(?:>|\s[^>]*>)/gi, "\n  Verification: ")
      .replace(/<\/verification>/gi, "\n")
      .trim();

  // Tokenize the string by matching the start of any block we care about
  const blockRegex = /(<tool_results tool="([^"]*)">([\s\S]*?)<\/tool_results>|<step(?:>|\s[^>]*>)([\s\S]*?)<\/step>|<\s*(?:\|)?(?:thought|think)\b[^>]*>([\s\S]*?)<\/\s*(?:\|)?(?:thought|think)\b[^>]*>|<search query="([^"]*)" \/>)/gi;
  
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      const text = remaining.substring(lastIndex, match.index);
      if (text.trim()) {
        blocks.push({ type: "text", content: text });
      }
    }
    
    if (match[1].startsWith("<tool_results")) {
      const labelAttr = match[2];
      const body = match[3];
      const items: ToolResultsItem[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let it;
      while ((it = itemRegex.exec(body))) {
        const title = it[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
        const url = it[1].match(/<url>([\s\S]*?)<\/url>/i)?.[1] ?? "";
        const snippet = it[1].match(/<snippet>([\s\S]*?)<\/snippet>/i)?.[1] ?? "";
        if (title.trim()) {
          items.push({
            title: decodeHtml(title.trim()),
            url: decodeHtml(url.trim()),
            snippet: decodeHtml(snippet.trim()),
          });
        }
      }
      if (items.length > 0) {
        blocks.push({ type: "tool_results", label: decodeHtml(labelAttr || ""), items });
      }
    } else if (match[1].startsWith("<search")) {
      blocks.push({ type: "search", content: decodeURIComponent(match[6]) });
    } else if (match[1].startsWith("<step")) {
      const stepContent = match[4];
      if (stepContent && stepContent.trim()) {
        blocks.push({ type: "step", content: stepContent.trim() });
      }
    } else {
      const innerContent = match[5];
      if (innerContent && innerContent.trim()) {
        blocks.push({ type: "thought", content: stripInternal(innerContent) });
      }
    }
    
    lastIndex = blockRegex.lastIndex;
  }
  
  if (lastIndex < remaining.length) {
    let tail = remaining.substring(lastIndex);
    
    // Handle unclosed blocks if streaming
    if (isStreaming) {
      const unclosedThink = tail.match(/<\s*(?:\|)?(?:thought|think)\b[^>]*>/i);
      const unclosedStep = tail.match(/<step(?:>|\s[^>]*>)/i);
      
      let splitIdx = -1;
      if (unclosedThink && unclosedStep) {
        splitIdx = Math.min(tail.indexOf(unclosedThink[0]), tail.indexOf(unclosedStep[0]));
      } else if (unclosedThink) {
        splitIdx = tail.indexOf(unclosedThink[0]);
      } else if (unclosedStep) {
        splitIdx = tail.indexOf(unclosedStep[0]);
      }
      
      if (splitIdx !== -1) {
        const visible = tail.substring(0, splitIdx);
        const unclosed = tail.substring(splitIdx);
        if (visible.trim()) blocks.push({ type: "text", content: visible });
        const unclosedClean = stripInternal(unclosed);
        if (unclosedClean.trim()) {
           if (unclosed.startsWith("<step")) {
               blocks.push({ type: "step", content: unclosedClean });
           } else {
               blocks.push({ type: "thought", content: unclosedClean });
           }
        }
        tail = "";
      }
    }
    
    if (tail.trim()) {
      blocks.push({ type: "text", content: tail });
    }
  }
  
  // Final cleanup on visible text blocks
  for (const block of blocks) {
    if (block.type === "text" && block.content) {
       block.content = block.content
         .replace(/<action[^>]*>[\s\S]*?<\/action>/gi, "")
         .replace(/<action[^>]*>/gi, "")
         .replace(/<\/?\s*(?:\|)?(?:thought|think)\b[^>]*>/gi, "")
         .replace(/<step(?:>|\s[^>]*>)/gi, "")
         .replace(/<\/step>/gi, "")
         .replace(/<tool_results[\s\S]*?<\/tool_results>/gi, "")
         // Convert basic HTML formatting to markdown
         .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
         .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
         .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
         .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
         // Strip common internal-monologue label prefixes that models sometimes
         // emit outside <think> tags. These should never appear as visible text.
         .replace(/^\s*Internal\s+[Ss]tate\s*:?\s*/gm, "")
         .replace(/^\s*(?:My\s+)?(?:inner\s+)?[Tt]hought(?:s)?\s*:?\s*/gm, "")
         .replace(/^\s*Final\s+Answer\s*:\s*/i, "")
         // Remove lines that are ONLY the words "Action:" or "Answer:" (model labels)
         .replace(/^\s*Action\s*:\s*$/gm, "")
         .replace(/^\s*Answer\s*:\s*$/gm, "")
         // Strip trailing CJK/emoji junk
         .replace(/[㐀-鿿豈-﫿぀-ヿ가-힯\u0590-\u05FF\uD800-\uDBFF\uDC00-\uDFFF\uD83C-\uD83E]+$/u, "")
         .trim();
    }
  }

  // Determine raw copy text
  const rawCopyText = blocks.filter(b => b.type === "text").map(b => b.content).join("\n").trim();
  const hasThoughts = blocks.some(b => b.type === "thought");
  const hasVisibleText = rawCopyText.length > 0;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(rawCopyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [rawCopyText]);

  const [openStates, setOpenStates] = useState<Record<number, boolean>>({});
  const toggleBlock = useCallback((idx: number, open: boolean) => {
    setOpenStates(prev => ({ ...prev, [idx]: open }));
  }, []);

  return (
    <div className="group animate-fade-in" style={{ marginBottom: "var(--message-gap)" }}>
      <div className="flex gap-3">
        {/* Avatar mark */}
        <div className="flex-shrink-0 mt-1">
          <CogitoMark size={22} className={isStreaming && !content ? "animate-logo-thinking" : ""} />
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0" data-role="assistant">
          {(() => {
            type BlockType = typeof blocks[0];
            type GroupType = BlockType | { type: "thought_group"; items: BlockType[] };
            
            const groupedBlocks: GroupType[] = [];
            let currentGroup: BlockType[] = [];
            for (const block of blocks) {
              if (block.type === "text") {
                if (currentGroup.length > 0) {
                  groupedBlocks.push({ type: "thought_group", items: currentGroup });
                  currentGroup = [];
                }
                groupedBlocks.push(block);
              } else {
                currentGroup.push(block);
              }
            }
            if (currentGroup.length > 0) {
              groupedBlocks.push({ type: "thought_group", items: currentGroup });
            }

            return groupedBlocks.map((group, groupIdx) => {
              if (group.type === "thought_group") {
                const isOpen = openStates[groupIdx] ?? true;
                return (
                  <details
                    key={groupIdx}
                    className="mb-4 text-sm-ui group"
                    open={isOpen}
                    onToggle={(e) => toggleBlock(groupIdx, e.currentTarget.open)}
                  >
                    <summary className="inline-flex items-center gap-2.5 cursor-pointer select-none outline-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 list-none [&::-webkit-details-marker]:hidden">
                      {isStreaming && groupIdx === groupedBlocks.length - 1 ? (
                        <span className="font-medium animate-pulse text-[var(--accent-primary)]">Thinking...</span>
                      ) : (
                        <span className="font-medium">Thought process</span>
                      )}
                      <ChevronDownIcon
                        size={12}
                        className="opacity-50 transition-transform duration-200 group-open:rotate-180"
                      />
                    </summary>
                    <div className="mt-3 ml-2 border-l-[2px] border-[var(--border-subtle)] space-y-4">
                      {group.items.map((item, itemIdx) => {
                        if (item.type === "thought") {
                          return (
                            <div
                              key={itemIdx}
                              className="pl-4 text-[var(--text-secondary)] opacity-90 whitespace-pre-wrap leading-relaxed"
                              style={{ fontSize: "0.95em", fontFamily: "var(--font-body)" }}
                            >
                              {item.content}
                            </div>
                          );
                        }
                        if (item.type === "search" || item.type === "step") {
                          let label = item.content || "";
                          if (item.type === "step") {
                            const qMatch = label.match(/for "([^"]+)"/);
                            if (qMatch) {
                              label = qMatch[1];
                            } else {
                              label = label.replace(/^Action:\s*Using.*?\.\.\.$/i, "Running tool").trim();
                            }
                          }
                          return (
                            <div key={itemIdx} className="pl-4 inline-flex items-center gap-2 text-sm-ui text-[var(--text-secondary)]">
                              <SearchIcon size={14} className="opacity-70" />
                              <span className="opacity-70">Searched:</span>
                              <span className="font-medium text-[var(--text-primary)] opacity-90">{label}</span>
                            </div>
                          );
                        }
                        if (item.type === "tool_results") {
                          const resultStateKey = groupIdx * 1000 + itemIdx;
                          const isResultOpen = openStates[resultStateKey] ?? false;
                          return (
                            <details
                              key={itemIdx}
                              className="pl-4 text-sm-ui group/results"
                              open={isResultOpen}
                              onToggle={(e) => toggleBlock(resultStateKey, e.currentTarget.open)}
                            >
                              <summary className="inline-flex items-center gap-2 cursor-pointer select-none outline-none text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150 list-none [&::-webkit-details-marker]:hidden">
                                <ChevronDownIcon
                                  size={14}
                                  className="transition-transform duration-200 group-open/results:rotate-180"
                                />
                                <span className="font-medium">Search results ({item.items?.length})</span>
                              </summary>
                              <ul className="mt-2 ml-6 space-y-2 border-l-[2px] border-[var(--border-subtle)] pl-3">
                                {item.items?.map((res, i) => (
                                  <li key={i}>
                                    <a
                                      href={res.url || undefined}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                                    >
                                      <span className="block font-medium text-[var(--text-primary)]">{res.title}</span>
                                      {res.snippet && (
                                        <span className="block opacity-80">{res.snippet}</span>
                                      )}
                                      {res.url && (
                                        <span className="block text-xs opacity-60 break-all">{res.url}</span>
                                      )}
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </details>
                );
              }

              if (group.type === "text") {
                return (
                  <div key={groupIdx} className={`min-w-0 break-words ${groupIdx < groupedBlocks.length - 1 ? "mb-4" : ""}`} data-role="assistant-visible-text">
                    <MarkdownRenderer content={group.content || ""} />
                  </div>
                );
              }
              return null;
            });
          })()}

          {!isStreaming && !hasVisibleText && hasThoughts && (
            <p
              className="text-[var(--text-secondary)] opacity-70 italic"
              style={{ fontSize: "0.95em" }}
            >
              (no visible reply was generated — the model stopped after its thought.)
            </p>
          )}

          {!isStreaming && sources && sources.length > 0 && (
            <SourceChips sources={sources} />
          )}

          {!isStreaming && content && (
            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <button
                onClick={handleCopy}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--surface-hover)] transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
              </button>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--surface-hover)] transition-colors"
                  title="Retry"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2v6h-6"></path>
                    <path d="M3 12a9 9 0 102.13-5.87L21 8"></path>
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
