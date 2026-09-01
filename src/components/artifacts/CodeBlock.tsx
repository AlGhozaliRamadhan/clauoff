"use client";

import React, { useState, useEffect, memo, useMemo } from "react";
import { CopyIcon, CheckIcon } from "@/components/ui/Icons";
import { codeToHtml } from "shiki";
import { useArtifact } from "@/contexts/ArtifactContext";

interface CodeBlockProps {
  language: string;
  value: string;
}

export function inferArtifactMeta(language: string, code: string) {
  const lang = (language || "text").toLowerCase().trim();
  const lines = code.trim().split("\n");
  const firstLine = lines[0]?.trim() || "";

  let title = "";
  const commentTitle = firstLine.match(/^(?:\/\/\s*|#\s*|<!--\s*)([A-Za-z0-9_\-\s]+?)(?:\s*-->|\s*\*\/|$)/);
  if (commentTitle && commentTitle[1].trim().length > 2 && commentTitle[1].trim().length < 50) {
    title = commentTitle[1].trim();
  } else if (["html", "htm"].includes(lang)) {
    const htmlTitle = code.match(/<title>([^<]+)<\/title>/i);
    if (htmlTitle) title = htmlTitle[1].trim();
  } else if (["jsx", "tsx", "react"].includes(lang) || (["js", "ts", "javascript", "typescript"].includes(lang) && code.includes("function "))) {
    const compName = code.match(/(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/);
    if (compName) title = `${compName[1]}`;
  }

  if (!title) {
    const titles: Record<string, string> = {
      html: "Interactive Web Page",
      htm: "Interactive Web Page",
      svg: "Vector Graphic",
      jsx: "React Component",
      tsx: "React Component",
      react: "React Component",
      python: "Python Script",
      py: "Python Script",
      javascript: "JavaScript Program",
      js: "JavaScript Program",
      typescript: "TypeScript Program",
      ts: "TypeScript Program",
      css: "Stylesheet",
      markdown: "Document",
      md: "Document",
      json: "Data File",
      sql: "SQL Query",
    };
    title = titles[lang] || "Code Artifact";
  }

  let subtitle = `${lang.toUpperCase()} · Code`;
  if (["html", "htm"].includes(lang)) subtitle = "HTML · Web Page";
  else if (["jsx", "tsx", "react"].includes(lang)) subtitle = "React · Component";
  else if (lang === "svg") subtitle = "Image · SVG";
  else if (["py", "python"].includes(lang)) subtitle = "Python · Script";
  else if (["js", "javascript"].includes(lang)) subtitle = "JavaScript · App";
  else if (["ts", "typescript"].includes(lang)) subtitle = "TypeScript · App";
  else if (["md", "markdown"].includes(lang)) subtitle = "Document · Markdown";

  return { title, subtitle, lang };
}

export function getFileExtension(language: string): string {
  const lang = (language || "").toLowerCase().trim();
  const map: Record<string, string> = {
    html: "html",
    htm: "html",
    svg: "svg",
    jsx: "jsx",
    tsx: "tsx",
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    python: "py",
    py: "py",
    css: "css",
    markdown: "md",
    md: "md",
    json: "json",
    sql: "sql",
  };
  return map[lang] || "txt";
}

export function ArtifactIcon({ language }: { language: string }) {
  const lang = (language || "").toLowerCase().trim();
  
  if (["jsx", "tsx", "react"].includes(lang)) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 opacity-90">
        <circle cx="12" cy="12" r="2" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        <path d="M2 12a15.3 15.3 0 0 1 10-4 15.3 15.3 0 0 1 10 4 15.3 15.3 0 0 1-10 4 15.3 15.3 0 0 1-10-4z" />
      </svg>
    );
  }
  
  if (["html", "htm"].includes(lang)) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 opacity-90">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }

  if (lang === "svg") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 opacity-90">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    );
  }

  if (["py", "python"].includes(lang)) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 opacity-90">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)]">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export const CodeBlock = memo(function CodeBlock({ language, value }: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const { setActiveArtifact } = useArtifact();

  const lines = useMemo(() => value.trim().split("\n"), [value]);
  const lineCount = lines.length;
  const lang = (language || "text").toLowerCase().trim();

  // Determine if this block qualifies as an auto-opening Sandbox Artifact
  const isArtifact = useMemo(() => {
    if (["html", "htm", "svg", "jsx", "tsx", "react"].includes(lang) && lineCount >= 4) {
      return true;
    }
    return false;
  }, [lang, lineCount]);

  const { title, subtitle } = useMemo(() => inferArtifactMeta(language, value), [language, value]);

  // Auto-open in the sandbox only for interactive web artifacts
  useEffect(() => {
    if (isArtifact && value.trim().length > 0) {
      setActiveArtifact({
        language,
        content: value,
        title,
        subtitle,
      });
    }
  }, [isArtifact, language, value, title, subtitle, setActiveArtifact]);

  useEffect(() => {
    let isMounted = true;
    const highlight = async () => {
      try {
        const result = await codeToHtml(value, {
          lang: language || "text",
          theme: "github-dark-dimmed",
        });
        if (isMounted) setHtml(result);
      } catch {
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

  const handleCopy = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ext = getFileExtension(language);
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${ext}`;
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenArtifact = () => {
    setActiveArtifact({
      language,
      content: value,
      title,
      subtitle,
    });
  };

  // If this qualifies as a Sandbox Artifact, render the sleek Artifact Card in chat (no duplicate code block)
  if (isArtifact) {
    return (
      <div className="my-3.5 select-text">
        <div
          onClick={handleOpenArtifact}
          className="flex items-center justify-between p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[rgba(255,255,255,0.18)] transition-all duration-150 cursor-pointer group shadow-sm"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[var(--surface-app)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              <ArtifactIcon language={language} />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-sm text-[var(--text-primary)] truncate group-hover:text-white transition-colors">
                {title}
              </div>
              <div className="text-xs text-[var(--text-secondary)] opacity-80 mt-0.5">
                {subtitle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
              title="Download file"
              aria-label="Download file"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>

            <button
              onClick={handleCopy}
              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
              title="Copy code"
              aria-label="Copy code"
            >
              {copied ? <CheckIcon size={15} className="text-emerald-400" /> : <CopyIcon size={15} />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenArtifact();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.14)] text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6m0 5v6h-6M3 9V3h6m5 18H3v-6"/>
              </svg>
              <span>Open Sandbox</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Standard clean markdown code block for short snippets
  return (
    <div
      className="group rounded-xl overflow-hidden my-3.5 border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition-all"
    >
      <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-[var(--border-subtle)] bg-[rgba(255,255,255,0.02)]">
        <span className="text-xs text-[var(--text-secondary)] font-mono lowercase opacity-75">
          {language || "text"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded hover:bg-[rgba(255,255,255,0.06)] transition-colors cursor-pointer"
          aria-label="Copy code"
        >
          {copied ? <CheckIcon size={13} className="text-emerald-400" /> : <CopyIcon size={13} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto font-mono text-sm text-[var(--text-on-accent)] leading-relaxed">
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} className="shiki-wrapper [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0" />
        ) : (
          <pre className="!bg-transparent !p-0 !m-0"><code>{value}</code></pre>
        )}
      </div>
    </div>
  );
});
