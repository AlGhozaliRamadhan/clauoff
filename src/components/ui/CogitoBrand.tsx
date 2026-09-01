"use client";

import React from "react";

/**
 * Cogito logo mark — a warm-accent geometric mark.
 * Intentionally NOT the Anthropic sunburst; uses a simple diamond/star shape.
 */
export function CogitoMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/CogitoIcon-transparant.png"
      alt="Cogito Logo"
      width={size}
      height={size}
      draggable={false}
      className={`select-none pointer-events-none ${className}`}
    />
  );
}

/**
 * Cogito wordmark — the product name in UI font weight.
 * Matches Claude's sidebar header text style: bold, ~20px.
 */
export function CogitoWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-medium text-[21px] tracking-[-0.01em] ${className}`}
      style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
    >
      Cogito
    </span>
  );
}
