"use client";

import React from "react";
import { CogitoWordmark } from "./CogitoBrand";
import { useAuth } from "@/contexts/AuthContext";
import {
  PlusIcon,
  ChatBubbleIcon,
  FolderIcon,
  ArtifactsIcon,
  SearchIcon,
  SidebarIcon,
  ChevronUpDownIcon,
  AllChatsIcon,
  DownloadIcon,
  SettingsIcon,
  ChevronRightIcon,
  UserPlusIcon,
  DatabaseIcon,
  ShieldCheckIcon,
} from "./Icons";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  conversations: Array<{ id: string; title: string; isActive?: boolean }>;
  onSelectConversation?: (id: string) => void;
  onOpenSettings?: () => void;
  onOpenProjects?: () => void;
  onOpenChats?: () => void;
}

/** Main navigation item in the sidebar — matches Claude's exact styling. */
function NavItem({
  icon,
  label,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-[7px] rounded-lg text-left transition-colors duration-150 cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
      style={{ fontFamily: "var(--font-ui)", fontSize: "14px", lineHeight: "20px" }}
    >
      <span className="flex-shrink-0 text-[var(--text-secondary)]">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span
          className="px-1.5 py-0.5 rounded text-[11px] font-medium"
          style={{
            background: "var(--accent-primary)",
            color: "var(--text-on-accent)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/** A single conversation entry in the Recents list. */
function ConversationItem({
  title,
  isActive = false,
  onClick,
}: {
  title: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left px-3 py-[6px] rounded-lg truncate
        transition-colors duration-150 cursor-pointer
        ${
          isActive
            ? "bg-[var(--bg-sidebar-active)] text-[var(--text-primary)]"
            : "text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
        }
      `}
      style={{ fontFamily: "var(--font-ui)", fontSize: "14px", lineHeight: "20px" }}
    >
      {title}
    </button>
  );
}

/** Filter/settings icon for Recents header — two sliders icon matching Claude */
function RecentsFilterIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="5" cy="4" r="1.2" fill="var(--surface-sidebar)" stroke="currentColor" strokeWidth="1" />
      <circle cx="11" cy="8" r="1.2" fill="var(--surface-sidebar)" stroke="currentColor" strokeWidth="1" />
      <circle cx="7" cy="12" r="1.2" fill="var(--surface-sidebar)" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function GlobeIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function HelpIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoCircleIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function LogOutIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function Sidebar({
  isOpen,
  onToggle,
  onNewChat,
  conversations,
  onSelectConversation,
  onOpenSettings,
  onOpenProjects,
  onOpenChats,
}: SidebarProps) {
  const { user, openAuthModal, logout } = useAuth();
  const [showAccountMenu, setShowAccountMenu] = React.useState(false);
  const accountMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const avatarInitial = (user?.displayName || user?.username || "G").slice(0, 1).toUpperCase();
  const avatarBg = user?.avatarColor || "var(--text-primary)";
  const avatarText = user?.avatarColor ? "#FFFFFF" : "var(--surface-sidebar)";

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full flex flex-col
          transition-transform duration-200 ease-out
          lg:relative lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:hidden"}
        `}
        style={{
          width: "var(--sidebar-width)",
          background: "var(--surface-sidebar)",
          borderRight: "1px solid var(--border-subtle)",
        }}
      >
        {/* ── Header: wordmark + search + sidebar toggle ── */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-1.5">
            <CogitoWordmark />
          </div>
          <div className="flex items-center gap-0.5">
            <button
              className="p-1.5 rounded-lg hover:bg-[var(--bg-sidebar-hover)] transition-colors text-[var(--text-secondary)] cursor-pointer"
              aria-label="Search"
            >
              <SearchIcon size={18} />
            </button>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-sidebar-hover)] transition-colors text-[var(--text-secondary)] cursor-pointer"
              aria-label="Toggle sidebar"
            >
              <SidebarIcon size={16} />
            </button>
          </div>
        </div>

        {/* ── Navigation list (no separator, tight spacing) ── */}
        <nav className="px-2 space-y-[1px]">
          {/* New chat — same visual weight as other nav items */}
          <button
            onClick={onNewChat}
            className="flex items-center gap-3 w-full px-3 py-[7px] rounded-lg text-left transition-colors duration-150 cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
            style={{ fontFamily: "var(--font-ui)", fontSize: "14px", lineHeight: "20px" }}
          >
            <PlusIcon size={18} className="text-[var(--text-secondary)]" />
            <span>New chat</span>
          </button>

          {/* Main nav items */}
          <NavItem
            icon={<ChatBubbleIcon size={18} />}
            label="Chats"
            onClick={onOpenChats ?? onNewChat}
          />
          <NavItem
            icon={<FolderIcon size={18} />}
            label="Projects"
            onClick={onOpenProjects}
          />
          <NavItem icon={<ArtifactsIcon size={18} />} label="Artifacts" />
        </nav>

        {/* ── Recents section ── */}
        <div className="flex-1 px-2 mt-3 overflow-y-auto min-h-0">
          <div className="flex items-center justify-between px-3 pb-1">
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: "12px",
                lineHeight: "16px",
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              Recents
            </span>
            <button
              className="p-0.5 rounded hover:bg-[var(--bg-sidebar-hover)] transition-colors text-[var(--text-secondary)] cursor-pointer"
              aria-label="Filter recents"
            >
              <RecentsFilterIcon />
            </button>
          </div>
          <div className="space-y-[1px]">
            {conversations.length === 0 ? (
              <div
                className="px-3 py-6 text-center"
                style={{ color: "var(--text-secondary)", fontSize: "14px" }}
              >
                No conversations yet
              </div>
            ) : (
              <>
                {conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    title={conv.title}
                    isActive={conv.isActive}
                    onClick={() => onSelectConversation?.(conv.id)}
                  />
                ))}
                {/* All chats button matching Claude */}
                <button
                  className="flex items-center gap-3 w-full px-3 py-[7px] mt-1 rounded-lg text-left transition-colors duration-150 cursor-pointer text-[var(--text-secondary)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--text-primary)]"
                  style={{ fontFamily: "var(--font-ui)", fontSize: "14px", lineHeight: "20px" }}
                >
                  <AllChatsIcon size={18} className="flex-shrink-0" />
                  <span className="flex-1 truncate">All chats</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Account footer ── */}
        <div
          ref={accountMenuRef}
          className="mt-auto relative transition-colors duration-150 hover:bg-[var(--bg-sidebar-hover)]"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {showAccountMenu && (
            <div
              className="absolute bottom-full left-2.5 right-2.5 mb-2 rounded-2xl py-2 z-50 animate-fade-in flex flex-col"
              style={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-dropdown)",
              }}
            >
              {/* Profile details header */}
              <div className="px-4 py-2 border-b border-[var(--border-subtle)] mb-1">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-xs"
                    style={{ background: avatarBg, color: avatarText }}
                  >
                    {avatarInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {user ? user.displayName : "Guest User"}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate flex items-center gap-1 font-mono">
                      {user ? `@${user.username}` : "Not signed in"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              {!user ? (
                <button
                  className="flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-left text-sm-ui text-[var(--accent-primary)] font-medium"
                  onClick={() => {
                    setShowAccountMenu(false);
                    openAuthModal("login");
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <UserPlusIcon size={16} />
                    <span>Sign In / Create Account</span>
                  </div>
                </button>
              ) : (
                <button
                  className="flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-left text-sm-ui text-[var(--text-primary)]"
                  onClick={() => {
                    setShowAccountMenu(false);
                    openAuthModal("switch");
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <UserPlusIcon size={16} className="text-[var(--text-secondary)]" />
                    <span>Switch Account</span>
                  </div>
                </button>
              )}

              <button
                className="flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-left text-sm-ui text-[var(--text-primary)]"
                onClick={() => {
                  setShowAccountMenu(false);
                  onOpenSettings?.();
                }}
              >
                <div className="flex items-center gap-2.5">
                  <SettingsIcon size={16} className="text-[var(--text-secondary)]" />
                  <span>Settings</span>
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] opacity-70">Ctrl+,</span>
              </button>

              <div className="my-1 border-t border-[var(--border-subtle)]" />

              {user ? (
                <button
                  className="flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-left text-sm-ui text-red-400"
                  onClick={() => {
                    setShowAccountMenu(false);
                    logout();
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <LogOutIcon size={16} />
                    <span>Sign Out</span>
                  </div>
                </button>
              ) : null}
            </div>
          )}

          <button
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="flex items-center gap-2.5 w-full px-4 py-3 cursor-pointer text-left"
          >
            {/* Avatar circle (contrast-based cream/dark background or custom color) */}
            <div
              className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 shadow-sm"
              style={{
                background: avatarBg,
                color: avatarText,
              }}
            >
              {avatarInitial}
            </div>
            {/* Name and Subtitle */}
            <div className="flex-1 text-left min-w-0 flex flex-col justify-center">
              <div
                className="truncate font-medium text-xs"
                style={{ fontSize: "14px", lineHeight: "18px", color: "var(--text-primary)" }}
              >
                {user ? user.displayName : "Personal"}
              </div>
              <div
                className="truncate text-[11px] font-normal"
                style={{ color: "var(--text-secondary)", lineHeight: "14px" }}
              >
                {user ? `@${user.username}` : "Free Plan"}
              </div>
            </div>
            {/* Chevron controls */}
            <div className="flex items-center flex-shrink-0">
              <ChevronUpDownIcon size={14} className="text-[var(--text-secondary)] flex-shrink-0" />
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}
