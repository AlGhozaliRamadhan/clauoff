"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useArtifact } from "@/contexts/ArtifactContext";
import { CopyIcon, CheckIcon } from "@/components/ui/Icons";
import { codeToHtml } from "shiki";
import { MarkdownRenderer } from "./MarkdownRenderer";

function generateReactSandbox(code: string): string {
  const cleanedCode = code
    .replace(/import\s+React\s*,\s*\{[^}]*\}\s+from\s+['"][^'"]+['"];?/g, "")
    .replace(/import\s+React\s+from\s+['"][^'"]+['"];?/g, "")
    .replace(/import\s+.*?\s+from\s+['"][^'"]+['"];?/g, "")
    .replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/, "function $1")
    .replace(/export\s+default\s+([A-Za-z0-9_]+);?/, "");

  const match = code.match(/(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/);
  const componentName = match ? match[1] : "App";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ffffff; color: #111827; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo, useCallback } = React;
    try {
      ${cleanedCode}
      const RootComponent = typeof ${componentName} !== 'undefined' ? ${componentName} : () => <div>Component ${componentName} rendered.</div>;
      ReactDOM.createRoot(document.getElementById('root')).render(<RootComponent />);
    } catch (err) {
      document.getElementById('root').innerHTML = '<div style="color: #ef4444; padding: 16px; font-family: monospace; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;"><strong>Runtime Error:</strong><br/>' + err.message + '</div>';
    }
  </script>
</body>
</html>`;
}

function generateHtmlPreview(code: string): string {
  if (code.includes("<html") || code.includes("<!DOCTYPE")) {
    return code;
  }
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #ffffff; color: #111827; }
  </style>
</head>
<body>
  ${code}
</body>
</html>`;
}

function getFileExtension(language: string): string {
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

export function ArtifactViewer() {
  const { activeArtifact, setActiveArtifact } = useArtifact();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("code");
  const [highlightedCode, setHighlightedCode] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastArtifactKeyRef = React.useRef<string | null>(null);

  const lang = (activeArtifact?.language || "text").toLowerCase().trim();
  const isReact = ["jsx", "tsx", "react"].includes(lang) || (["javascript", "typescript", "js", "ts"].includes(lang) && Boolean(activeArtifact?.content && (activeArtifact.content.includes("useState") || activeArtifact.content.includes("React") || activeArtifact.content.includes("</"))));
  const isHtml = ["html", "htm"].includes(lang);
  const isSvg = lang === "svg";
  const isMarkdown = ["markdown", "md"].includes(lang);
  const isPreviewable = isHtml || isSvg || isReact || isMarkdown;

  // Only set initial tab when a new artifact is opened, not on every streaming token!
  useEffect(() => {
    if (activeArtifact) {
      const artifactKey = `${activeArtifact.id || ""}:${activeArtifact.title || ""}:${activeArtifact.language || ""}`;
      if (lastArtifactKeyRef.current !== artifactKey) {
        lastArtifactKeyRef.current = artifactKey;
        // Default to "code" so the user can watch the code streaming, or switch to preview
        setActiveTab("code");
      }
    }
  }, [activeArtifact?.id, activeArtifact?.title, activeArtifact?.language]);

  useEffect(() => {
    if (!activeArtifact?.content) return;
    let isMounted = true;

    const highlight = async () => {
      try {
        const result = await codeToHtml(activeArtifact.content, {
          lang: lang || "text",
          theme: "github-dark-dimmed",
        });
        if (isMounted) setHighlightedCode(result);
      } catch {
        if (isMounted) {
          const escaped = activeArtifact.content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          setHighlightedCode(`<pre><code>${escaped}</code></pre>`);
        }
      }
    };

    highlight();
    return () => {
      isMounted = false;
    };
  }, [activeArtifact?.content, lang]);

  const previewDoc = useMemo(() => {
    if (!activeArtifact?.content) return "";
    if (isReact) return generateReactSandbox(activeArtifact.content);
    if (isHtml) return generateHtmlPreview(activeArtifact.content);
    if (isSvg) return generateHtmlPreview(`<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px;">${activeArtifact.content}</div>`);
    return "";
  }, [activeArtifact?.content, isReact, isHtml, isSvg]);

  if (!activeArtifact) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeArtifact.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const ext = getFileExtension(activeArtifact.language);
    const filename = `${(activeArtifact.title || "artifact").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${ext}`;
    const blob = new Blob([activeArtifact.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`flex flex-col h-full bg-[var(--surface-raised)] border-l border-[var(--border-subtle)] w-full max-w-full overflow-hidden animate-fade-in shadow-xl transition-all ${
        isFullscreen ? "fixed inset-0 z-50 border-l-0" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-app)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm-ui text-[var(--text-primary)] truncate max-w-[240px]">
                {activeArtifact.title || "Artifact Preview"}
              </h3>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                {activeArtifact.subtitle || activeArtifact.language || "code"}
              </span>
            </div>
          </div>
          
          {isPreviewable && (
            <div className="flex bg-[rgba(255,255,255,0.05)] rounded-lg p-0.5 ml-2">
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1 text-xs-ui rounded-md font-medium transition-colors ${
                  activeTab === "preview" 
                    ? "bg-[rgba(255,255,255,0.12)] text-[var(--text-primary)] shadow-sm" 
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setActiveTab("code")}
                className={`px-3 py-1 text-xs-ui rounded-md font-medium transition-colors ${
                  activeTab === "code" 
                    ? "bg-[rgba(255,255,255,0.12)] text-[var(--text-primary)] shadow-sm" 
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Code
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          {/* Download button */}
          <button
            onClick={handleDownload}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors cursor-pointer"
            title="Download file"
            aria-label="Download artifact"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>

          {/* Copy code button */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors cursor-pointer"
            title="Copy code"
            aria-label="Copy code"
          >
            {copied ? <CheckIcon size={16} className="text-emerald-400" /> : <CopyIcon size={16} />}
          </button>

          {/* Fullscreen toggle button */}
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6m0 5v6h-6M3 9V3h6m5 18H3v-6"/>
              </svg>
            )}
          </button>

          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />

          {/* Close button */}
          <button
            onClick={() => {
              setIsFullscreen(false);
              setActiveArtifact(null);
            }}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)] rounded-lg transition-colors cursor-pointer"
            title="Close"
            aria-label="Close artifact viewer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-[var(--surface-app)] relative">
        {activeTab === "preview" && isPreviewable ? (
          isMarkdown ? (
            <div className="w-full h-full p-6 overflow-auto">
              <MarkdownRenderer content={activeArtifact.content} />
            </div>
          ) : (
            <div className="w-full h-full bg-white">
              <iframe
                srcDoc={previewDoc}
                className="w-full h-full border-0 bg-transparent"
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
                title="Preview"
              />
            </div>
          )
        ) : (
          <div className="p-4 overflow-auto font-mono text-sm text-[var(--text-on-accent)] min-h-full">
            {highlightedCode ? (
              <div dangerouslySetInnerHTML={{ __html: highlightedCode }} className="shiki-wrapper" />
            ) : (
              <pre className="whitespace-pre-wrap break-all"><code>{activeArtifact.content}</code></pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
