"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { PencilIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon, CopyIcon } from "./Icons";
import type { VersionInfo } from "./ChatThread";

export interface MessageBubbleUserProps {
  messageId: string;
  content: string;
  versionInfo?: VersionInfo;
  onEdit?: (messageId: string, newContent: string) => void;
  onSwitchVersion?: (targetNodeId: string) => void;
  disabled?: boolean;
}

/**
 * User message bubble — right-anchored with putty/tan fill.
 * Supports in-place message editing, branch checkpoints, and version switching (< 1/2 >).
 */
export function MessageBubbleUser({
  messageId,
  content,
  versionInfo,
  onEdit,
  onSwitchVersion,
  disabled = false,
}: MessageBubbleUserProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state if content updates
  useEffect(() => {
    setEditValue(content);
  }, [content]);

  // Auto-resize and focus textarea when editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 260)}px`;
    }
  }, [isEditing]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 260)}px`;
    }
  };

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === content) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    onEdit?.(messageId, trimmed);
  }, [editValue, content, messageId, onEdit]);

  const handleCancel = useCallback(() => {
    setEditValue(content);
    setIsEditing(false);
  }, [content]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [content]);

  const hasMultipleVersions = versionInfo && versionInfo.total > 1;

  if (isEditing) {
    return (
      <div className="flex justify-end w-full animate-fade-in" style={{ marginBottom: "var(--message-gap)" }}>
        <div
          className="w-full max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl border shadow-lg flex flex-col gap-2.5 transition-all"
          style={{
            background: "var(--surface-raised)",
            borderColor: "var(--border-strong)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full bg-transparent outline-none resize-none text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] text-sm leading-relaxed"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-base)",
              lineHeight: "var(--lh-base)",
            }}
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!editValue.trim() || disabled}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--text-primary)] text-[var(--surface-sidebar)] hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm transition-opacity"
            >
              Save & Submit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-end group animate-fade-in"
      style={{ marginBottom: "var(--message-gap)" }}
    >
      <div className="flex items-end gap-2 max-w-[85%] sm:max-w-[75%]">
        {/* User Action buttons (Edit & Copy) - appears on hover */}
        {!disabled && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 mb-1 flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                title="Edit message"
                aria-label="Edit message"
              >
                <PencilIcon size={14} />
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
              title="Copy prompt"
              aria-label="Copy prompt"
            >
              {copied ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {/* User turn bubble */}
        <div
          className="px-4 py-3 whitespace-pre-wrap rounded-2xl break-words"
          style={{
            background: "var(--surface-user-bubble)",
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-base)",
            lineHeight: "var(--lh-base)",
            color: "var(--text-primary)",
          }}
        >
          {content}
        </div>
      </div>

      {/* Version switcher (< 1/2 >) if message was edited */}
      {hasMultipleVersions && onSwitchVersion && (
        <div className="flex items-center gap-1 mt-1 text-[11px] text-[var(--text-secondary)] select-none">
          <button
            type="button"
            disabled={versionInfo.currentIndex === 0 || disabled}
            onClick={() => {
              if (versionInfo.currentIndex > 0) {
                onSwitchVersion(versionInfo.siblings[versionInfo.currentIndex - 1]);
              }
            }}
            className="p-0.5 rounded hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Previous version"
            aria-label="Previous version"
          >
            <ChevronLeftIcon size={12} />
          </button>
          <span className="font-mono px-0.5">
            {versionInfo.currentIndex + 1} / {versionInfo.total}
          </span>
          <button
            type="button"
            disabled={versionInfo.currentIndex >= versionInfo.total - 1 || disabled}
            onClick={() => {
              if (versionInfo.currentIndex < versionInfo.total - 1) {
                onSwitchVersion(versionInfo.siblings[versionInfo.currentIndex + 1]);
              }
            }}
            className="p-0.5 rounded hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Next version"
            aria-label="Next version"
          >
            <ChevronRightIcon size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
