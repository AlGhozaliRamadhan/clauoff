"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { CogitoMark } from "@/components/ui/CogitoBrand";
import { CopyIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, RefreshIcon } from "@/components/ui/Icons";
import { SourceChips } from "./SourceChips";
import { MarkdownRenderer } from "@/components/artifacts/MarkdownRenderer";
import { ThinkingPanel, type ThinkingItem } from "./ThinkingPanel";
import { CodeBlock, inferArtifactMeta, getFileExtension, ArtifactIcon } from "@/components/artifacts/CodeBlock";
import { AudioPlayerButton } from "@/components/audio/AudioPlayerButton";
import { useArtifact } from "@/contexts/ArtifactContext";
import { parseAnyToolCall } from "@/lib/agent/tool-parser";
import type { SourceCitation } from "@/lib/rag/types";
import type { VersionInfo } from "./ChatThread";
import type { GeneratedImageInfo } from "@/lib/images/types";
import { GeneratedImageCard } from "./GeneratedImageCard";

interface MessageAssistantProps {
  content: string;
  isStreaming?: boolean;
  sources?: SourceCitation[];
  onRetry?: (messageId?: string) => void;
  messageId?: string;
  versionInfo?: VersionInfo;
  onSwitchVersion?: (targetNodeId: string) => void;
  image?: GeneratedImageInfo;
  responseType?: "chat" | "image";
}

interface ToolResultsItem {
  title: string;
  url: string;
  snippet: string;
}

function ArtifactCard({
  language,
  content,
  title,
  identifier,
  isStreaming,
}: {
  language: string;
  content: string;
  title: string;
  identifier?: string;
  isStreaming?: boolean;
}) {
  const { setActiveArtifact } = useArtifact();
  const [copied, setCopied] = useState(false);

  const meta = useMemo(() => inferArtifactMeta(language, content), [language, content]);
  const displayTitle = title || meta.title;
  const displaySubtitle = meta.subtitle;

  // Auto-open in the sandbox right away from token 1
  useEffect(() => {
    if (content.trim()) {
      setActiveArtifact({
        id: identifier,
        language,
        content,
        title: displayTitle,
        subtitle: displaySubtitle,
      });
    }
  }, [content, language, displayTitle, displaySubtitle, identifier, setActiveArtifact]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ext = getFileExtension(language);
    const filename = `${displayTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${ext}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpen = () => {
    setActiveArtifact({
      id: identifier,
      language,
      content,
      title: displayTitle,
      subtitle: displaySubtitle,
    });
  };

  return (
    <div className="my-3 select-text animate-fade-in">
      <div
        onClick={handleOpen}
        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 cursor-pointer group shadow-sm ${
          isStreaming
            ? "border-[var(--accent-primary)]/50 bg-[var(--surface-raised)] shadow-[0_0_15px_rgba(217,119,87,0.1)]"
            : "border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[rgba(255,255,255,0.18)]"
        }`}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-[var(--surface-app)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            {isStreaming ? (
              <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArtifactIcon language={language} />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
              {displayTitle}
            </div>
            <div className="text-xs text-[var(--text-secondary)] truncate mt-0.5 flex items-center gap-1.5">
              {isStreaming ? (
                <>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                  <span className="text-[var(--accent-primary)] font-medium">Generating in sandbox…</span>
                </>
              ) : (
                displaySubtitle || "Click to open sandbox"
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-3">
          {!isStreaming && (
            <>
              <button
                onClick={handleCopy}
                title="Copy code"
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                {copied ? <CheckIcon className="w-4 h-4 text-emerald-400" /> : <CopyIcon className="w-4 h-4" />}
              </button>
              <button
                onClick={handleDownload}
                title="Download file"
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
            </>
          )}
          <span className="text-xs font-mono uppercase text-[var(--text-secondary)] bg-[var(--surface-app)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
            {language}
          </span>
        </div>
      </div>
    </div>
  );
}

function decodeHtml(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|#39|#039);/g, (match) => {
    switch (match) {
      case "&amp;":
        return "&";
      case "&lt;":
        return "<";
      case "&gt;":
        return ">";
      case "&quot;":
        return '"';
      case "&#39;":
      case "&#039;":
        return "'";
      default:
        return match;
    }
  });
}

export function MessageAssistant({
  content,
  isStreaming = false,
  sources,
  onRetry,
  messageId,
  versionInfo,
  onSwitchVersion,
  image,
  responseType,
}: MessageAssistantProps) {
  const [copied, setCopied] = useState(false);

  const blocks: {
    type: "text" | "thought" | "tool_results" | "search" | "step" | "confidence" | "artifact";
    content?: string;
    label?: string;
    title?: string;
    language?: string;
    identifier?: string;
    items?: ToolResultsItem[];
  }[] = [];
  
  // Normalize orphan closing </think> tags when backend templates prefilled <think>
  let normalizedContent = content;
  const firstOpenThink = normalizedContent.search(/<\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>/i);
  const firstCloseThink = normalizedContent.search(/<\/\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>/i);
  if (firstCloseThink !== -1 && (firstOpenThink === -1 || firstCloseThink < firstOpenThink)) {
    normalizedContent = `<think>${normalizedContent}`;
  }

  let remaining = normalizedContent;

  // Clean out things we never want to show
  const stripInternal = (raw: string): string =>
    raw
      .replace(/<\s*(?:human|user)\s*>[\s\S]*?<\/\s*(?:human|user)\s*>\s*/gi, "")
      .replace(/<\/?\s*(?:human|user|assistant)\b[^>]*>/gi, "")
      .replace(/<confidence>[\s\S]*?<\/confidence>\s*/gi, "")
      .replace(/<tool_call[\s\S]*?<\/tool_call>\s*/gi, "")
      .replace(/<tool_response[\s\S]*?<\/tool_response>\s*/gi, "")
      .replace(/<action[^>]*>[\s\S]*?<\/action>\s*/gi, "")
      .replace(/<\/?\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>/gi, "")
      .replace(/<\/?\s*(?:hotfix|patch|fix|update|output|message|code_block|file|response|code)\b[^>]*>/gi, "")
      .replace(/<step(?:>|\s[^>]*>)/gi, "")
      .replace(/<\/step>/gi, "")
      .replace(/<verification(?:>|\s[^>]*>)/gi, "\n  Verification: ")
      .replace(/<\/verification>/gi, "\n")
      .trim();

  const pushTextBlock = (rawText: string) => {
    // Strip echoed user/human turn tags (e.g. "<human> ... </human>")
    const cleanedText = rawText
      .replace(/<\s*(?:human|user)\s*>[\s\S]*?<\/\s*(?:human|user)\s*>\s*/gi, "")
      .replace(/<\/?\s*(?:human|user|assistant)\b[^>]*>/gi, "")
      .replace(/<\/?\s*(?:hotfix|patch|fix|update|output|message|code_block|file|response|code)\b[^>]*>/gi, "");

    // Ignore lone meta labels like "text", "response", "hotfix"
    if (/^\s*(?:text|response|reply|output|content|answer|action|code|hotfix|patch|update)\s*$/i.test(cleanedText)) {
      return;
    }

    // Check for lone confidence marker (e.g. "confidence 0.95", ": Confidence: 0.8")
    const loneConf = cleanedText.match(/^\s*(?::\s*)?Confidence(?:\s*Score)?\s*:?\s*((?:0\.\d+|1(?:\.0+)?|\d+%|[A-Za-z]+))\s*$/i);
    if (loneConf) {
      blocks.push({ type: "confidence", content: loneConf[1] });
      return;
    }

    // Check for untagged confidence monologue followed by action/answer, e.g.:
    // ": Confidence 0.65 The greeting is simple... Action: answer Hello there!"
    const confMatch = cleanedText.match(
      /^(\s*:\s*|\s*)Confidence(?:\s*Score)?\s*:?\s*((?:0\.\d+|1(?:\.0+)?|\d+%|[A-Za-z]+)?)\b([\s\S]*?)(?:Action:\s*\w+\s*|Answer:\s*|Final Answer:\s*|\b(?:ask_clarification|ask_question|clarify|answer|admit_ignorance|cannot_answer|apologize|refuse|generate_code|write_code|code_generation|create_code|generate_response|write_response)\s+(?=[A-Z0-9"“'‘`]))([\s\S]*)$/i
    );
    if (confMatch) {
      const score = confMatch[2]?.trim();
      const thoughtBody = confMatch[3]?.trim();
      const visibleReply = confMatch[4];
      if (score) {
        blocks.push({ type: "confidence", content: score });
      }
      if (thoughtBody) {
        blocks.push({ type: "thought", content: stripInternal(thoughtBody) });
      }
      if (visibleReply.trim()) {
        blocks.push({ type: "text", content: visibleReply });
      }
      return;
    }

    // If text starts with confidence monologue
    const confStart = cleanedText.match(/^(\s*:\s*|\s*)Confidence(?:\s*Score)?\s*:?\s*((?:0\.\d+|1(?:\.0+)?|\d+%|[A-Za-z]+)?)\b([\s\S]*)$/i);
    if (confStart) {
      const score = confStart[2]?.trim();
      const thoughtBody = confStart[3]?.trim();
      if (score) {
        blocks.push({ type: "confidence", content: score });
      }
      if (thoughtBody) {
        blocks.push({
          type: "thought",
          content: stripInternal(thoughtBody),
        });
      }
      return;
    }

    if (cleanedText.trim()) {
      blocks.push({ type: "text", content: cleanedText });
    }
  };

  // Tokenize the string by matching the start of any block we care about
  const blockRegex = /(<confidence>([\s\S]*?)<\/confidence>|<tool_results tool="([^"]*)">([\s\S]*?)<\/tool_results>|<step(?:>|\s[^>]*>)([\s\S]*?)<\/step>|(<tool_call[\s\S]*?<\/tool_call>)|<tool_response[\s\S]*?<\/tool_response>|<\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>([\s\S]*?)<\/\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>|<search query="([^"]*)" \/>|<(?:antA|a)rtifact\s+([^>]*)>([\s\S]*?)<\/(?:antA|a)rtifact>|```(html|htm|jsx|tsx|react|svg)\s*\n([\s\S]*?)```)/gi;
  
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      const text = remaining.substring(lastIndex, match.index);
      pushTextBlock(text);
    }
    
    if (match[1].startsWith("<confidence")) {
      const score = match[2]?.trim();
      if (score) {
        blocks.push({ type: "confidence", content: score });
      }
    } else if (match[1].startsWith("<tool_results")) {
      const labelAttr = match[3];
      const body = match[4];
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
      blocks.push({ type: "search", content: decodeURIComponent(match[8]) });
    } else if (match[1].startsWith("<step")) {
      const stepContent = match[5];
      if (stepContent && stepContent.trim()) {
        blocks.push({ type: "step", content: stepContent.trim() });
      }
    } else if (match[1].startsWith("<tool_call")) {
      const parsed = parseAnyToolCall(match[1]);
      if (parsed) {
        blocks.push({
          type: "step",
          content: `Action: Using ${parsed.name}${parsed.input ? ` for "${parsed.input}"` : ""}...`,
        });
      }
    } else if (match[1].startsWith("<tool_response")) {
      // Internal tool response
    } else if (match[1].toLowerCase().startsWith("<artifact") || match[1].toLowerCase().startsWith("<antartifact")) {
      const attrs = match[9] || "";
      const body = match[10] || "";
      const title = attrs.match(/title=['"]([^'"]*)['"]/i)?.[1] || "";
      const language = attrs.match(/language=['"]([^'"]*)['"]/i)?.[1] || attrs.match(/type=['"]([^'"]*)['"]/i)?.[1] || "text";
      const identifier = attrs.match(/identifier=['"]([^'"]*)['"]/i)?.[1];
      blocks.push({
        type: "artifact",
        content: body,
        title,
        language,
        identifier,
      });
    } else if (match[1].startsWith("```")) {
      const lang = match[11] || "html";
      const code = match[12] || "";
      const meta = inferArtifactMeta(lang, code);
      blocks.push({
        type: "artifact",
        content: code,
        title: meta.title,
        language: lang,
      });
    } else {
      const innerContent = match[7];
      if (innerContent && innerContent.trim()) {
        blocks.push({ type: "thought", content: stripInternal(innerContent) });
      }
    }
    
    lastIndex = blockRegex.lastIndex;
  }
  
  if (lastIndex < remaining.length) {
    let tail = remaining.substring(lastIndex);
    
    // Always detect and parse unclosed blocks (thoughts, steps, artifacts)
    // so that stopped-mid-thought or streaming states always settle inside the ThinkingPanel
    const unclosedThink = tail.match(/<\s*(?:\|)?(?:thought|think|thinking)\b[^>]*>/i);
    const unclosedStep = tail.match(/<step(?:>|\s[^>]*>)/i);
    const unclosedArtifact = tail.match(/<(?:antA|a)rtifact\s+([^>]*)>/i);
    const unclosedCodeArtifact = tail.match(/```(html|htm|jsx|tsx|react|svg)\b/i);
    
    const indices = [
      unclosedThink ? tail.indexOf(unclosedThink[0]) : -1,
      unclosedStep ? tail.indexOf(unclosedStep[0]) : -1,
      unclosedArtifact ? tail.indexOf(unclosedArtifact[0]) : -1,
      unclosedCodeArtifact ? tail.indexOf(unclosedCodeArtifact[0]) : -1,
    ].filter((i) => i !== -1);
    
    let splitIdx = -1;
    if (indices.length > 0) {
      splitIdx = Math.min(...indices);
    }
    
    if (splitIdx !== -1) {
      const visible = tail.substring(0, splitIdx);
      const unclosed = tail.substring(splitIdx);
      pushTextBlock(visible);
      if (unclosed.startsWith("<step")) {
        const unclosedClean = stripInternal(unclosed);
        if (unclosedClean.trim()) blocks.push({ type: "step", content: unclosedClean });
      } else if (unclosed.toLowerCase().startsWith("<artifact") || unclosed.toLowerCase().startsWith("<antartifact")) {
        const openTag = unclosed.match(/<(?:antA|a)rtifact\s+([^>]*)>/i);
        const attrs = openTag?.[1] || "";
        const title = attrs.match(/title=['"]([^'"]*)['"]/i)?.[1] || "";
        const language = attrs.match(/language=['"]([^'"]*)['"]/i)?.[1] || attrs.match(/type=['"]([^'"]*)['"]/i)?.[1] || "text";
        const identifier = attrs.match(/identifier=['"]([^'"]*)['"]/i)?.[1];
        const tagLen = openTag ? openTag[0].length : 0;
        const body = unclosed.substring(tagLen);
        blocks.push({
          type: "artifact",
          content: body,
          title,
          language,
          identifier,
        });
      } else if (unclosed.startsWith("```")) {
        const matchCode = unclosed.match(/```(html|htm|jsx|tsx|react|svg)[^\n]*\n?/i);
        const lang = matchCode?.[1] || "html";
        const tagLen = matchCode ? matchCode[0].length : 3;
        const body = unclosed.substring(tagLen);
        const meta = inferArtifactMeta(lang, body);
        blocks.push({
          type: "artifact",
          content: body,
          title: meta.title,
          language: lang,
        });
      } else {
        const unclosedClean = stripInternal(unclosed);
        if (unclosedClean.trim()) blocks.push({ type: "thought", content: unclosedClean });
      }
      tail = "";
    }
    
    if (tail.trim()) {
      pushTextBlock(tail);
    }
  }
  
  // Final cleanup on visible text blocks
  for (const block of blocks) {
    if (block.type === "text" && block.content) {
       block.content = block.content
         .replace(/<\s*(?:human|user)\s*>[\s\S]*?<\/\s*(?:human|user)\s*>\s*/gi, "")
         .replace(/<\/?\s*(?:human|user|assistant)\b[^>]*>/gi, "")
         .replace(/<\/?\s*(?:center|broadcast|paragraph|div|span|header|footer)\b[^>]*>/gi, "")
         .replace(/<action[^>]*>[\s\S]*?<\/action>/gi, "")
         .replace(/<action[^>]*>/gi, "")
         .replace(/<\/?\s*(?:\|)?(?:thought|think)\b[^>]*>/gi, "")
         .replace(/<\/?\s*(?:hotfix|patch|fix|update|output|message|code_block|file|response|code)\b[^>]*>/gi, "")
         .replace(/<step(?:>|\s[^>]*>)/gi, "")
         .replace(/<\/step>/gi, "")
         .replace(/<tool_results[\s\S]*?<\/tool_results>/gi, "")
         // Convert basic HTML formatting to markdown
         .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
         .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
         .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
         .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
         // Strip common internal-monologue and answer/action label prefixes that models sometimes
         // emit outside <think> tags. These should never appear as visible text.
         .replace(/^\s*Internal\s+[Ss]tate\s*:?\s*/gm, "")
         .replace(/^\s*(?:My\s+)?(?:inner\s+)?[Tt]hought(?:s)?\s*:?\s*/gm, "")
         .replace(/^\s*(?::\s*)?Confidence(?:\s*Score)?\s*:?\s*(?:0\.\d+|1(?:\.0+)?|\d+%|[A-Za-z]+)?\s*$/gim, "")
         .replace(/^\s*(?::\s*)?Confidence(?:\s*Score)?\s*:?\s*(?:0\.\d+|1(?:\.0+)?|\d+%|[A-Za-z]+)?\b[^\n]*\n?/gim, "")
         .replace(/^\s*(?:Action\s*:?\s*)?(?:Final\s+)?Answer\s*[:\-–—]\s*/i, "")
         .replace(/^\s*(?:Action\s*:\s*)?(?:ask_clarification|ask_question|ask_user|clarify|clarification|request_clarification|final_answer|direct_answer|admit_ignorance|cannot_answer|apologize|refuse|generate_code|write_code|code_generation|create_code|generate_response|write_response|code|run_python|execute_python|python|python_interpreter|search_web|web_search|google_search|terminal|bash|shell|execute_command|run_command|code_runner)\s*[:\-–—]?\s*/i, "")
         .replace(/^\s*(?:run_python|execute_python|python_interpreter|search_web|web_search|google_search|terminal|bash|shell|execute_command|run_command|code_runner)\s*$/gim, "")
         .replace(/^\s*(?:text|response|reply|output|content|answer|action|code|hotfix|patch|update)\s*$/gim, "")
         .replace(/^\s*Action\s*:\s*(?:[a-z_]+\s*)?/i, "")
         .replace(/^\s*answer\s*[:\-–—]\s*/i, "")
         .replace(/^\s*answer\s+(?=[A-Z0-9"“'‘])/i, "")
         .replace(/^\s*Response\s*[:\-–—]\s*/i, "")
         .replace(/^\s*(?:Broadcast|center)\s*$/gim, "")
         .replace(/^\s*(?:search_web|fetch_web_page|run_python)\s*(?:\n|:|\()\s*["'“‘]?[\s\S]*?["'”’]?\s*\)?$/gim, "")
         .replace(/^\s*["'“‘](?:[a-zA-Z0-9_\-\s]{2,120})["'”’]\s*\.{0,3}\s*$/gm, "")
         // Remove standalone action/answer tags/labels
         .replace(/Action:\s*[a-z_]+\s*/gi, "")
         .replace(/^\s*Action\s*:\s*$/gm, "")
         .replace(/^\s*Answer\s*:\s*$/gm, "")
         // Strip trailing CJK/emoji junk
         .replace(/[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\u0590-\u05FF\u{1F000}-\u{1FAFF}]+$/u, "")
         .trim();
    }
  }

  // Determine raw copy text
  const rawCopyText = blocks
    .filter((b) => b.type === "text" || b.type === "artifact")
    .map((b) => b.content)
    .filter(Boolean)
    .join("\n")
    .trim();
  const hasThoughts = blocks.some((b) => b.type === "thought");
  const hasVisibleText = rawCopyText.length > 0;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(rawCopyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [rawCopyText]);

  const groups: Array<
    | { type: "text"; content: string }
    | { type: "thought_group"; items: ThinkingItem[] }
    | { type: "artifact"; content: string; title: string; language: string; identifier?: string }
  > = [];
  {
    let current: ThinkingItem[] = [];
    for (const block of blocks) {
      if (block.type === "text") {
        const textContent = (block.content ?? "").trim();
        if (!textContent) continue; // Skip empty / whitespace-only text blocks

        if (current.length > 0) {
          groups.push({ type: "thought_group", items: current });
          current = [];
        }
        groups.push({ type: "text", content: textContent });
      } else if (block.type === "artifact") {
        if (current.length > 0) {
          groups.push({ type: "thought_group", items: current });
          current = [];
        }
        groups.push({
          type: "artifact",
          content: block.content ?? "",
          title: block.title ?? "",
          language: block.language ?? "text",
          identifier: block.identifier,
        });
      } else {
        current.push(block as ThinkingItem);
      }
    }
    if (current.length > 0) {
      groups.push({ type: "thought_group", items: current });
    }
  }

  const activeGroups = groups.filter((g) => {
    if (g.type === "thought_group") return g.items.length > 0;
    if (g.type === "artifact") return Boolean(g.content.trim());
    return Boolean(g.content.trim());
  });

  return (
    <div className="group animate-fade-in" style={{ marginBottom: "var(--message-gap)" }}>
      <div className="flex gap-3">
        {/* Avatar mark */}
        <div className="flex-shrink-0 mt-0.5">
          <CogitoMark size={22} className={isStreaming && !content ? "animate-logo-thinking" : ""} />
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0" data-role="assistant">
          {image && <GeneratedImageCard image={image} />}

          {!image && isStreaming && responseType === "image" && (
            <div
              className="my-1 max-w-2xl overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)]"
              role="status"
              aria-label="Generating image"
            >
              <div className="flex items-center gap-3 px-4 py-6">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-app)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] animate-pulse" />
                    Rendering image…
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    This can take a few minutes on a remote GPU. You can keep chatting meanwhile.
                  </p>
                </div>
              </div>
              {/* Indeterminate shimmer bar */}
              <div className="h-1 w-full bg-[var(--surface-app)] overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-[var(--accent-primary)] opacity-70 animate-[image-progress-slide_1.4s_ease-in-out_infinite]" />
              </div>
            </div>
          )}

          {!image && activeGroups.map((group, groupIdx) => {
            if (group.type === "thought_group") {
              const isActivelyThinking = isStreaming && groupIdx === activeGroups.length - 1;
              return (
                <ThinkingPanel
                  key={groupIdx}
                  items={group.items}
                  isStreaming={isActivelyThinking}
                />
              );
            }
            if (group.type === "artifact") {
              return (
                <ArtifactCard
                  key={groupIdx}
                  language={group.language}
                  content={group.content}
                  title={group.title}
                  identifier={group.identifier}
                  isStreaming={isStreaming}
                />
              );
            }
            return (
              <div
                key={groupIdx}
                className={`min-w-0 break-words ${groupIdx < activeGroups.length - 1 ? "mb-4" : ""}`}
                data-role="assistant-visible-text"
              >
                <MarkdownRenderer content={group.content.trim()} />
              </div>
            );
          })}

          {!image && !isStreaming && !hasVisibleText && hasThoughts && (
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
            <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-xs-ui">
              {/* Version switcher (< 1/2 >) if multiple generations exist */}
              {versionInfo && versionInfo.total > 1 && onSwitchVersion && (
                <div className="flex items-center gap-0.5 mr-1 text-[11px] text-[var(--text-secondary)] select-none border border-[var(--border-subtle)] rounded-md px-1 py-0.5 bg-[var(--surface-raised)] shadow-2xs">
                  <button
                    type="button"
                    disabled={versionInfo.currentIndex === 0}
                    onClick={() => {
                      if (versionInfo.currentIndex > 0) {
                        onSwitchVersion(versionInfo.siblings[versionInfo.currentIndex - 1]);
                      }
                    }}
                    className="p-0.5 rounded hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Previous response"
                    aria-label="Previous response"
                  >
                    <ChevronLeftIcon size={12} />
                  </button>
                  <span className="font-mono px-1">
                    {versionInfo.currentIndex + 1} / {versionInfo.total}
                  </span>
                  <button
                    type="button"
                    disabled={versionInfo.currentIndex >= versionInfo.total - 1}
                    onClick={() => {
                      if (versionInfo.currentIndex < versionInfo.total - 1) {
                        onSwitchVersion(versionInfo.siblings[versionInfo.currentIndex + 1]);
                      }
                    }}
                    className="p-0.5 rounded hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    title="Next response"
                    aria-label="Next response"
                  >
                    <ChevronRightIcon size={12} />
                  </button>
                </div>
              )}

              {!image && (
                <>
                  <AudioPlayerButton
                    text={rawCopyText || content}
                    id={messageId || `msg-${rawCopyText.slice(0, 16)}`}
                    size={15}
                  />
                  <button
                    onClick={handleCopy}
                    className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                    title="Copy to clipboard"
                  >
                    {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                  </button>
                </>
              )}
              {onRetry && (
                <button
                  onClick={() => onRetry(messageId)}
                  className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  title="Retry response"
                  aria-label="Retry response"
                >
                  <RefreshIcon size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
