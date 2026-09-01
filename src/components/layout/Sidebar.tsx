"use client";

import React from "react";
import { CogitoWordmark } from "@/components/ui/CogitoBrand";
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
  PencilIcon,
  TrashIcon,
  SkillsIcon,
} from "@/components/ui/Icons";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  conversations: Array<{ id: string; title: string; isActive?: boolean }>;
  onSelectConversation?: (id: string) => void;
  onRenameConversation?: (id: string, newTitle: string) => void;
  onDeleteConversation?: (id: string) => void;
  onOpenSettings?: (tab?: string) => void;
  onOpenProjects?: () => void;
  onOpenChats?: () => void;
  hasUpdate?: boolean;
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

/** A single conversation entry in the Recents list with inline rename and delete. */
function ConversationItem({
  id,
  title,
  isActive = false,
  onClick,
  onRename,
  onDelete,
}: {
  id: string;
  title: string;
  isActive?: boolean;
  onClick?: () => void;
  onRename?: (id: string, newTitle: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(title);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setEditValue(title);
  }, [title]);

  React.useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onRename?.(id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditValue(title);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center px-2 py-1 bg-[var(--bg-sidebar-active)] rounded-lg">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-sm-ui text-[var(--text-primary)] outline-none border-b border-[var(--accent-primary)] px-1 py-0.5"
          style={{ fontFamily: "var(--font-ui)", fontSize: "14px" }}
        />
      </div>
    );
  }

  return (
    <div
      className={`
        group relative flex items-center justify-between w-full px-3 py-[6px] rounded-lg
        transition-colors duration-150 cursor-pointer
        ${
          isActive
            ? "bg-[var(--bg-sidebar-active)] text-[var(--text-primary)]"
            : "text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)]"
        }
      `}
      onClick={onClick}
    >
      <span
        className="truncate flex-1 min-w-0"
        style={{ fontFamily: "var(--font-ui)", fontSize: "14px", lineHeight: "20px" }}
      >
        {title}
      </span>

      {/* Action buttons (Rename & Delete) on hover / active */}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 pl-1 transition-opacity duration-150 flex-shrink-0">
        {onRename && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="p-1 rounded hover:bg-[rgba(255,255,255,0.1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Rename chat"
            aria-label="Rename chat"
          >
            <PencilIcon size={13} />
          </button>
        )}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id);
            }}
            className="p-1 rounded hover:bg-[rgba(255,255,255,0.1)] text-[var(--text-secondary)] hover:text-red-400 transition-colors cursor-pointer"
            title="Delete chat"
            aria-label="Delete chat"
          >
            <TrashIcon size={13} />
          </button>
        )}
      </div>
    </div>
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
  onRenameConversation,
  onDeleteConversation,
  onOpenSettings,
  onOpenProjects,
  onOpenChats,
  hasUpdate = false,
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
                    id={conv.id}
                    title={conv.title}
                    isActive={conv.isActive}
                    onClick={() => onSelectConversation?.(conv.id)}
                    onRename={onRenameConversation}
                    onDelete={onDeleteConversation}
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

              {hasUpdate && (
                <button
                  className="flex items-center justify-between w-full px-4 py-2.5 bg-[rgba(201,96,63,0.12)] hover:bg-[rgba(201,96,63,0.2)] text-[var(--accent-primary)] cursor-pointer text-left text-sm-ui font-medium border-b border-[var(--border-subtle)]"
                  onClick={() => window.location.reload()}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-[2px] bg-[var(--accent-primary)] animate-pulse" />
                    <span>Update Ready — Reload</span>
                  </div>
                  <span className="text-xs font-mono">↻</span>
                </button>
              )}

              <button
                className="flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-left text-sm-ui text-[var(--text-primary)]"
                onClick={() => {
                  setShowAccountMenu(false);
                  onOpenSettings?.("skills");
                }}
              >
                <div className="flex items-center gap-2.5">
                  <SkillsIcon size={16} className="text-[var(--text-secondary)]" />
                  <span>Skills</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] font-mono">SKILL.MD</span>
              </button>

              <button
                className="flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-left text-sm-ui text-[var(--text-primary)]"
                onClick={() => {
                  setShowAccountMenu(false);
                  onOpenSettings?.("connectors");
                }}
              >
                <div className="flex items-center gap-2.5">
                  <DatabaseIcon size={16} className="text-[var(--text-secondary)]" />
                  <span>Connectors</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] font-mono">MCP</span>
              </button>

              <button
                className="flex items-center justify-between w-full px-4 py-2 hover:bg-[rgba(255,255,255,0.04)] cursor-pointer text-left text-sm-ui text-[var(--text-primary)]"
                onClick={() => {
                  setShowAccountMenu(false);
                  onOpenSettings?.("plugins");
                }}
              >
                <div className="flex items-center gap-2.5">
                  <FolderIcon size={16} className="text-[var(--text-secondary)]" />
                  <span>Plugins</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] font-mono">BUNDLE</span>
              </button>

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
            className="flex items-center gap-2.5 w-full px-4 py-3 cursor-pointer text-left relative"
          >
            {/* Avatar circle (contrast-based cream/dark background or custom color) */}
            <div className="relative flex-shrink-0">
              <div
                className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 shadow-sm"
                style={{
                  background: avatarBg,
                  color: avatarText,
                }}
              >
                {avatarInitial}
              </div>
              {/* Little orange square badge indicating new unread build update */}
              {hasUpdate && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-[2px] bg-[var(--accent-primary)] border-2 border-[var(--surface-sidebar)] shadow-sm animate-pulse"
                  title="Update ready — click to reload"
                />
              )}
            </div>
            {/* Name and Subtitle */}
            <div className="flex-1 text-left min-w-0 flex flex-col justify-center">
              <div
                className="truncate font-medium text-xs flex items-center gap-1.5"
                style={{ fontSize: "14px", lineHeight: "18px", color: "var(--text-primary)" }}
              >
                <span>{user ? user.displayName : "Personal"}</span>
                {hasUpdate && (
                  <span className="w-1.5 h-1.5 rounded-[2px] bg-[var(--accent-primary)] flex-shrink-0" />
                )}
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
