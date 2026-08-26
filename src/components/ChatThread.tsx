"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { MessageBubbleUser } from "./MessageBubbleUser";
import { MessageAssistant } from "./MessageAssistant";
import { ChevronDownIcon } from "./Icons";
import { getNodeSiblingInfo, type MessageNode } from "@/lib/tree-utils";
import type { SourceCitation } from "@/lib/rag/types";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  sources?: SourceCitation[];
}

export interface VersionInfo {
  currentIndex: number;
  total: number;
  siblings: string[];
}

interface ChatThreadProps {
  messages: Message[];
  treeMapping?: Record<string, MessageNode>;
  onRetry?: (messageId?: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  onSwitchVersion?: (targetNodeId: string) => void;
  isGenerating?: boolean;
}

export function ChatThread({
  messages,
  treeMapping,
  onRetry,
  onEditMessage,
  onSwitchVersion,
  isGenerating = false,
}: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const prevMessagesLengthRef = useRef(messages.length);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Handle user scrolling
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Check if user is scrolled up away from bottom (more than 120px)
    const isAwayFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight > 120;
    setShowScrollBottom(isAwayFromBottom);
  }, []);

  // Scroll down only when a new user turn or message is added
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      prevMessagesLengthRef.current = messages.length;
      scrollToBottom(true);
    }
  }, [messages.length, scrollToBottom]);

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 max-w-full relative"
      ref={scrollContainerRef}
      onScroll={handleScroll}
    >
      <div
        className="mx-auto px-4 py-8 min-w-0 max-w-full"
        style={{ maxWidth: "var(--content-max-width)" }}
      >
        {messages.map((msg, index) => {
          const isLastMessage = index === messages.length - 1;
          const versionInfo: VersionInfo | undefined = treeMapping
            ? getNodeSiblingInfo(treeMapping, msg.id)
            : undefined;

          return msg.role === "user" ? (
            <MessageBubbleUser
              key={msg.id}
              messageId={msg.id}
              content={msg.content}
              versionInfo={versionInfo}
              onEdit={onEditMessage}
              onSwitchVersion={onSwitchVersion}
              disabled={isGenerating}
            />
          ) : (
            <MessageAssistant
              key={msg.id}
              messageId={msg.id}
              content={msg.content}
              isStreaming={msg.isStreaming}
              sources={msg.sources}
              versionInfo={versionInfo}
              onSwitchVersion={onSwitchVersion}
              onRetry={onRetry ? () => onRetry(msg.id) : undefined}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Floating jump-to-bottom button when user scrolls up */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          className="fixed bottom-24 right-8 z-30 p-2 rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] shadow-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer animate-fade-in flex items-center justify-center"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ChevronDownIcon size={18} />
        </button>
      )}
    </div>
  );
}
