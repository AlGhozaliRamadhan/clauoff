"use client";

import React from "react";

interface MessageBubbleUserProps {
  content: string;
}

/**
 * User message bubble — right-anchored with a putty/tan fill.
 * Per DESIGN_SYSTEM.md: user turns get a bubble, max-width ~70%, text left-aligned inside.
 */
export function MessageBubbleUser({ content }: MessageBubbleUserProps) {
  return (
    <div className="flex justify-end animate-fade-in" style={{ marginBottom: "var(--message-gap)" }}>
      <div
        className="max-w-[70%] px-4 py-3 whitespace-pre-wrap"
        style={{
          background: "var(--surface-user-bubble)",
          borderRadius: "var(--bubble-radius)",
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-base)",
          lineHeight: "var(--lh-base)",
          color: "var(--text-primary)",
        }}
      >
        {content}
      </div>
    </div>
  );
}
