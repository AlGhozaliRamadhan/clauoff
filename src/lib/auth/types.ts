export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  createdAt: number;
  updatedAt: number;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  lastActive?: number;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: number;
  createdAt: number;
}

export interface AuthResponse {
  user: User;
  token: string;
  settings?: Record<string, string>;
}

export const AVATAR_COLORS = [
  "#C9603F", // Terracotta / Cogito Accent
  "#D97706", // Warm Amber
  "#059669", // Emerald
  "#0284C7", // Sky Blue
  "#7C3AED", // Violet
  "#DB2777", // Rose
  "#4B5563", // Slate
  "#B45309", // Ochre
];

