"use client";

import React, { useRef, useEffect } from "react";
import { MessageBubbleUser } from "./MessageBubbleUser";
import { MessageAssistant } from "./MessageAssistant";
import type { SourceCitation } from "@/lib/rag/types";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  sources?: SourceCitation[];
}

interface ChatThreadProps {
  messages: Message[];
  onRetry?: () => void;
}

export function ChatThread({ messages, onRetry }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Smart auto-scroll: only scroll if the user is already near the bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    // If the user is within 150px of the bottom, auto-scroll
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, messages[messages.length - 1]?.content]);

  return (
    <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
      <div
        className="mx-auto px-4 py-8"
        style={{ maxWidth: "var(--content-max-width)" }}
      >
        {messages.map((msg, index) => {
          const isLastMessage = index === messages.length - 1;
          
          return msg.role === "user" ? (
            <MessageBubbleUser key={msg.id} content={msg.content} />
          ) : (
            <MessageAssistant
              key={msg.id}
              content={msg.content}
              isStreaming={msg.isStreaming}
              sources={msg.sources}
              onRetry={isLastMessage ? onRetry : undefined}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
