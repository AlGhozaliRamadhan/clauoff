"use client";

import React from "react";
import { SidebarIcon } from "@/components/ui/Icons";

interface TopBarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

/**
 * Top bar for the main content area.
 * Shows sidebar toggle button when sidebar is collapsed.
 */
export function TopBar({ isSidebarOpen, onToggleSidebar }: TopBarProps) {
  if (isSidebarOpen) {
    return null;
  }

  return (
    <div className="flex items-center h-10 px-3 flex-shrink-0 bg-transparent z-10">
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-lg hover:bg-[var(--bg-sidebar-hover)] transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
        aria-label="Open sidebar"
        title="Open sidebar"
      >
        <SidebarIcon size={18} />
      </button>
    </div>
  );
}
