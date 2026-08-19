"use client";

import React, { useState, useEffect } from "react";
import { useArtifact } from "@/contexts/ArtifactContext";
import { CopyIcon, CheckIcon } from "./Icons";

export function ArtifactViewer() {
  const { activeArtifact, setActiveArtifact } = useArtifact();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"preview" | "code">("preview");

  // If artifact changes or closes, reset state
  useEffect(() => {
    if (activeArtifact) {
      // Default to code view if the artifact is not previewable
      const isPreviewable = ["html", "svg"].includes(activeArtifact.language.toLowerCase());
      setActiveTab(isPreviewable ? "preview" : "code");
    }
  }, [activeArtifact]);

  if (!activeArtifact) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeArtifact.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isPreviewable = ["html", "svg"].includes(activeArtifact.language.toLowerCase());

  return (
    <div className="flex flex-col h-full bg-[var(--surface-raised)] border-l border-[var(--border-subtle)] w-full max-w-full overflow-hidden animate-fade-in shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-app)]">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm-ui text-[var(--text-primary)] truncate max-w-[200px]">
            {activeArtifact.title || "Artifact Preview"}
          </h3>
          
          {isPreviewable && (
            <div className="flex bg-[rgba(255,255,255,0.05)] rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1 text-xs-ui rounded-md font-medium transition-colors ${
                  activeTab === "preview" 
                    ? "bg-[rgba(255,255,255,0.1)] text-[var(--text-primary)] shadow-sm" 
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setActiveTab("code")}
                className={`px-3 py-1 text-xs-ui rounded-md font-medium transition-colors ${
                  activeTab === "code" 
                    ? "bg-[rgba(255,255,255,0.1)] text-[var(--text-primary)] shadow-sm" 
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Code
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-colors flex items-center gap-1.5"
            title="Copy code"
          >
            {copied ? <CheckIcon size={16} className="text-[#4da3ff]" /> : <CopyIcon size={16} />}
          </button>
          <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" />
          <button
            onClick={() => setActiveArtifact(null)}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.05)] rounded-lg transition-colors flex items-center gap-1.5"
            title="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-[var(--surface-app)]">
        {activeTab === "preview" && isPreviewable ? (
          <div className="w-full h-full bg-white p-4">
            <iframe
              srcDoc={activeArtifact.content}
              className="w-full h-full border-0 bg-transparent rounded-lg shadow-sm"
              sandbox="allow-scripts allow-forms allow-popups"
              title="Preview"
            />
          </div>
        ) : (
          <div className="w-full h-full p-4 font-mono text-sm text-[var(--text-primary)] overflow-auto whitespace-pre-wrap break-all">
            {activeArtifact.content}
          </div>
        )}
      </div>
    </div>
  );
}
