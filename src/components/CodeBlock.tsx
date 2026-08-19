"use client";

import React, { useState, useEffect, memo } from "react";
import { CopyIcon, CheckIcon } from "./Icons";
import { codeToHtml } from "shiki";
import { useArtifact } from "@/contexts/ArtifactContext";

interface CodeBlockProps {
  language: string;
  value: string;
}

export const CodeBlock = memo(function CodeBlock({ language, value }: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const highlight = async () => {
      try {
        const result = await codeToHtml(value, {
          lang: language || "text",
          theme: "github-dark-default",
        });
        if (isMounted) setHtml(result);
      } catch (err) {
        // Failure fallback: shiki failed to highlight, so render plain text.
        // Escape the source before putting it in innerHTML — model output must
        // never be trusted as HTML (a failure here used to be an XSS sink).
        if (isMounted) {
          const escaped = value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          setHtml(`<pre><code>${escaped}</code></pre>`);
        }
      }
    };
    highlight();
    return () => {
      isMounted = false;
    };
  }, [language, value]);

  const { setActiveArtifact } = useArtifact();
  const isPreviewable = ["html", "svg"].includes((language || "").toLowerCase());

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      className="group rounded-md overflow-hidden my-4 border border-[var(--border-subtle)]"
      style={{ backgroundColor: "var(--surface-code-block)" }}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]" style={{ backgroundColor: "var(--surface-raised)" }}>
        <span className="text-xs text-[var(--text-secondary)] font-ui lowercase">
          {language || "text"}
        </span>
        <div className="flex items-center gap-2">
          {isPreviewable && (
            <button
              onClick={() => setActiveArtifact({ language, content: value, title: "Generated Code" })}
              className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors opacity-0 group-hover:opacity-100 touch-auto"
              aria-label="Preview code"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <span>Preview</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors opacity-0 group-hover:opacity-100 touch-auto"
            aria-label="Copy code"
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      <div className="p-4 overflow-x-auto font-mono text-sm text-[var(--text-on-accent)]">
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} className="shiki-wrapper" />
        ) : (
          <pre><code>{value}</code></pre>
        )}
      </div>
    </div>
  );
});
