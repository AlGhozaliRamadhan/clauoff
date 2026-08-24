"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User, PublicUser } from "@/lib/auth/types";
import type { Conversation } from "@/lib/conversation-store";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  savedUsers: PublicUser[];
  settings: Record<string, string>;
  isAuthModalOpen: boolean;
  authModalMode: "login" | "register" | "switch";
  lastSyncTime: number | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string, displayName?: string, avatarColor?: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { displayName?: string; avatarColor?: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  openAuthModal: (mode?: "login" | "register" | "switch") => void;
  closeAuthModal: () => void;
  refreshUsers: () => Promise<void>;
  syncConversationsToDb: (conversations: Conversation[]) => Promise<void>;
  loadConversationsFromDb: () => Promise<Conversation[] | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedUsers, setSavedUsers] = useState<PublicUser[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | "switch">("login");
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/users");
      if (res.ok) {
        const data = await res.json();
        setSavedUsers(data.users || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          if (data.settings) setSettings(data.settings);
        } else {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    refreshUsers();
  }, [checkAuth, refreshUsers]);

  const login = useCallback(
    async (username: string, password: string, rememberMe: boolean = true) => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, rememberMe }),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || "Login failed" };
        }

        setUser(data.user);
        if (data.settings) setSettings(data.settings);
        setIsAuthModalOpen(false);
        refreshUsers();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Network error during login",
        };
      }
    },
    [refreshUsers]
  );

  const register = useCallback(
    async (
      username: string,
      password: string,
      displayName?: string,
      avatarColor?: string,
      rememberMe: boolean = true
    ) => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, displayName, avatarColor, rememberMe }),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || "Registration failed" };
        }

        setUser(data.user);
        if (data.settings) setSettings(data.settings);
        setIsAuthModalOpen(false);
        refreshUsers();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Network error during registration",
        };
      }
    },
    [refreshUsers]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setUser(null);
      setSettings({});
      refreshUsers();
    }
  }, [refreshUsers]);

  const updateProfile = useCallback(
    async (data: { displayName?: string; avatarColor?: string; password?: string }) => {
      try {
        const res = await fetch("/api/auth/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const resData = await res.json();
        if (!res.ok) {
          return { success: false, error: resData.error || "Failed to update profile" };
        }

        if (resData.user) setUser(resData.user);
        if (resData.settings) setSettings(resData.settings);
        refreshUsers();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Update failed",
        };
      }
    },
    [refreshUsers]
  );

  const syncConversationsToDb = useCallback(
    async (conversations: Conversation[]) => {
      if (!user) return;
      try {
        const res = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversations }),
        });
        if (res.ok) {
          setLastSyncTime(Date.now());
        }
      } catch {
        // quiet sync failure
      }
    },
    [user]
  );

  const loadConversationsFromDb = useCallback(async (): Promise<Conversation[] | null> => {
    if (!user) return null;
    try {
      const res = await fetch("/api/auth/sync");
      if (!res.ok) return null;
      const data = await res.json();
      return (data.conversations ?? null) as Conversation[] | null;
    } catch {
      return null;
    }
  }, [user]);

  const openAuthModal = useCallback((mode: "login" | "register" | "switch" = "login") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        savedUsers,
        settings,
        isAuthModalOpen,
        authModalMode,
        lastSyncTime,
        login,
        register,
        logout,
        updateProfile,
        openAuthModal,
        closeAuthModal,
        refreshUsers,
        syncConversationsToDb,
        loadConversationsFromDb,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
