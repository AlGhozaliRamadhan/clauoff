"use client";

import React from "react";
import { SidebarIcon } from "./Icons";

interface TopBarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/**
 * Top bar for the main content area.
 * Shows sidebar toggle button when sidebar is hidden.
 */
export function TopBar({ isSidebarOpen, onToggleSidebar }: TopBarProps) {
  return (
    <div className="flex items-center h-12 px-4 flex-shrink-0">
      {/* Show sidebar toggle when sidebar is collapsed */}
      {!isSidebarOpen && (
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg hover:bg-[var(--border-subtle)] transition-colors text-[var(--text-secondary)] cursor-pointer"
          aria-label="Open sidebar"
        >
          <SidebarIcon size={16} />
        </button>
      )}
      <div className="flex-1" />
    </div>
  );
}
