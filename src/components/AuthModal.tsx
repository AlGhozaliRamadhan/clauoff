"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CogitoMark } from "./CogitoBrand";
import {
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  UserIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  DatabaseIcon,
  CheckIcon,
} from "./Icons";
import { AVATAR_COLORS } from "@/lib/auth/types";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "login" | "register" | "switch";
}

export function AuthModal({ isOpen, onClose, initialMode = "login" }: AuthModalProps) {
  const {
    login,
    register,
    savedUsers,
    user: currentUser,
  } = useAuth();

  const [mode, setMode] = useState<"login" | "register">(
    initialMode === "register" ? "register" : "login"
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuickUser, setSelectedQuickUser] = useState<string | null>(null);

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialMode === "register") {
        setMode("register");
      } else {
        setMode("login");
      }
      setTimeout(() => {
        if (username) {
          passwordInputRef.current?.focus();
        } else {
          usernameInputRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, initialMode, username]);

  if (!isOpen) return null;

  const handleQuickSelect = (uName: string) => {
    setUsername(uName);
    setSelectedQuickUser(uName);
    setMode("login");
    setError(null);
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setError("Please enter your username");
      usernameInputRef.current?.focus();
      return;
    }

    if (!password) {
      setError("Please enter your password");
      passwordInputRef.current?.focus();
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "login") {
        const result = await login(trimmedUser, password, rememberMe);
        if (!result.success) {
          setError(result.error || "Invalid username or password");
        } else {
          onClose();
        }
      } else {
        const result = await register(
          trimmedUser,
          password,
          displayName.trim() || trimmedUser,
          avatarColor,
          rememberMe
        );
        if (!result.success) {
          setError(result.error || "Could not create account");
        } else {
          onClose();
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.72)",
        backdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && currentUser) {
          onClose();
        }
      }}
    >
      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-[440px] rounded-2xl overflow-hidden shadow-2xl transition-all border"
        style={{
          backgroundColor: "var(--surface-raised)",
          borderColor: "var(--border-subtle)",
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.5), 0 0 1px 1px rgba(255, 255, 255, 0.08)",
        }}
      >
        {/* Subtle warm accent ambient glow */}
        <div
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full pointer-events-none opacity-20 blur-3xl"
          style={{ backgroundColor: "var(--accent-primary)" }}
        />
        <div
          className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full pointer-events-none opacity-10 blur-3xl"
          style={{ backgroundColor: "var(--accent-primary)" }}
        />

        {/* Close Button (if user is already logged in or wants to dismiss) */}
        {currentUser && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sidebar-hover)] transition-colors cursor-pointer z-10"
            aria-label="Close"
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <div className="p-6 sm:p-8">
          {/* Header Brand */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3 flex items-center justify-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center p-2.5 shadow-lg border border-[rgba(255,255,255,0.08)]"
                style={{
                  background: "linear-gradient(135deg, rgba(201, 96, 63, 0.15) 0%, rgba(34, 34, 34, 0.8) 100%)",
                }}
              >
                <CogitoMark size={36} />
              </div>
            </div>
            <h2
              className="text-2xl font-semibold tracking-tight"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-display)",
              }}
            >
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p
              className="text-xs sm:text-sm mt-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {mode === "login" ? "Sign in to your account" : "Set up your username and password"}
            </p>
          </div>

          {/* Quick User Switcher (if local profiles exist) */}
          {savedUsers.length > 0 && mode === "login" && (
            <div className="mb-5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)] mb-2 px-1">
                Saved Accounts on this Machine
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                {savedUsers.map((u) => {
                  const isSelected = selectedQuickUser === u.username || username.toLowerCase() === u.username.toLowerCase();
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickSelect(u.username)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-left transition-all cursor-pointer flex-shrink-0 ${
                        isSelected
                          ? "border-[var(--accent-primary)] bg-[rgba(201,96,63,0.1)] text-[var(--text-primary)]"
                          : "border-[var(--border-subtle)] bg-[rgba(255,255,255,0.02)] hover:bg-[var(--bg-sidebar-hover)] text-[var(--text-secondary)]"
                      }`}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs"
                        style={{ backgroundColor: u.avatarColor || "var(--accent-primary)" }}
                      >
                        {(u.displayName || u.username).slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium max-w-[100px] truncate">
                        {u.displayName || u.username}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab Selector */}
          <div
            className="flex p-1 rounded-xl mb-5 border"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.25)",
              borderColor: "var(--border-subtle)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === "login"
                  ? "bg-[var(--surface-user-bubble)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <UserIcon size={15} />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === "register"
                  ? "bg-[var(--surface-user-bubble)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <UserPlusIcon size={15} />
              <span>Create Account</span>
            </button>
          </div>

          {/* Error Message Box */}
          {error && (
            <div
              className="mb-4 px-3.5 py-2.5 rounded-xl text-xs flex items-start gap-2.5 animate-fade-in border"
              style={{
                backgroundColor: "rgba(220, 38, 38, 0.12)",
                borderColor: "rgba(220, 38, 38, 0.3)",
                color: "#FCA5A5",
              }}
            >
              <span className="text-sm flex-shrink-0 mt-0.5">⚠️</span>
              <span className="flex-1 leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Username field */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Username
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[var(--text-secondary)] opacity-70 pointer-events-none">
                  <UserIcon size={16} />
                </span>
                <input
                  ref={usernameInputRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. alex"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all border outline-none"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            {/* Display Name (Register only) */}
            {mode === "register" && (
              <div className="animate-fade-in">
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all border outline-none"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            )}

            {/* Avatar Color Picker (Register only) */}
            {mode === "register" && (
              <div className="animate-fade-in">
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Avatar Accent Color
                </label>
                <div className="flex items-center gap-2 pt-0.5">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAvatarColor(c)}
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
                      style={{
                        backgroundColor: c,
                        boxShadow: avatarColor === c ? "0 0 0 2px var(--surface-raised), 0 0 0 4px " + c : "none",
                      }}
                    >
                      {avatarColor === c && <CheckIcon size={12} className="text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Password field */}
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: "var(--text-secondary)" }}
              >
                Password
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-[var(--text-secondary)] opacity-70 pointer-events-none">
                  <LockIcon size={16} />
                </span>
                <input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter local password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl text-sm transition-all border outline-none"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.2)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--accent-primary)] cursor-pointer"
                />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Keep me signed in locally
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-2.5 px-4 rounded-xl font-medium text-sm text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "var(--accent-primary)",
              }}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === "login" ? "Sign In to Cogito" : "Create Local Account"}</span>
                  <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Continue as Guest option */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer underline-offset-4 hover:underline"
            >
              Continue without signing in (Guest mode)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
