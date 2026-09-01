import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDataRoot } from "@/lib/rag/paths";
import type { Conversation } from "@/store/conversation-store";
import { type User, type PublicUser, type Session, AVATAR_COLORS } from "./types";

let mainDbInstance: Database.Database | null = null;

export function getMainDbPath(): string {
  return path.join(getDataRoot(), "cogito.db");
}

const AUTH_MIGRATION = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#C9603F',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS user_conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  messages_json TEXT NOT NULL,
  project_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_conversations_user ON user_conversations(user_id);
`;

export function openMainDb(customPath?: string): Database.Database {
  if (customPath) {
    const db = new Database(customPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.exec(AUTH_MIGRATION);
    return db;
  }

  if (mainDbInstance) return mainDbInstance;

  const dataDir = getDataRoot();
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(getMainDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(AUTH_MIGRATION);

  mainDbInstance = db;
  return db;
}

export function closeMainDb(): void {
  if (mainDbInstance) {
    try {
      mainDbInstance.close();
    } catch {
      // ignore
    }
    mainDbInstance = null;
  }
}

// -------------------------------------------------------------
// Password Hashing using Node.js crypto.scryptSync
// -------------------------------------------------------------
export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// -------------------------------------------------------------
// User Management
// -------------------------------------------------------------
export function createUser(
  params: {
    username: string;
    password: string;
    displayName?: string;
    avatarColor?: string;
  },
  db: Database.Database = openMainDb()
): User {
  const username = params.username.trim();
  if (!username) {
    throw new Error("Username is required");
  }
  if (username.length < 2) {
    throw new Error("Username must be at least 2 characters");
  }
  if (params.password.length < 3) {
    throw new Error("Password must be at least 3 characters");
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE")
    .get(username);
  if (existing) {
    throw new Error("A user with this username already exists");
  }

  const id = crypto.randomUUID();
  const salt = generateSalt();
  const passwordHash = hashPassword(params.password, salt);
  const now = Date.now();
  const displayName = params.displayName?.trim() || username;
  const avatarColor =
    params.avatarColor ||
    AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  db.prepare(
    `INSERT INTO users (id, username, display_name, password_hash, salt, avatar_color, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, username, displayName, passwordHash, salt, avatarColor, now, now);

  return {
    id,
    username,
    displayName,
    avatarColor,
    createdAt: now,
    updatedAt: now,
  };
}

export function authenticateUser(
  username: string,
  password: string,
  db: Database.Database = openMainDb()
): User | null {
  const row = db
    .prepare(
      `SELECT id, username, display_name, password_hash, salt, avatar_color, created_at, updated_at
       FROM users WHERE username = ? COLLATE NOCASE`
    )
    .get(username.trim()) as
    | {
        id: string;
        username: string;
        display_name: string;
        password_hash: string;
        salt: string;
        avatar_color: string;
        created_at: number;
        updated_at: number;
      }
    | undefined;

  if (!row) return null;

  const computedHash = hashPassword(password, row.salt);
  if (computedHash !== row.password_hash) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getUserById(
  userId: string,
  db: Database.Database = openMainDb()
): User | null {
  const row = db
    .prepare(
      `SELECT id, username, display_name, avatar_color, created_at, updated_at
       FROM users WHERE id = ?`
    )
    .get(userId) as
    | {
        id: string;
        username: string;
        display_name: string;
        avatar_color: string;
        created_at: number;
        updated_at: number;
      }
    | undefined;

  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listPublicUsers(db: Database.Database = openMainDb()): PublicUser[] {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_color,
              MAX(s.created_at) as last_active
       FROM users u
       LEFT JOIN sessions s ON u.id = s.user_id
       GROUP BY u.id
       ORDER BY last_active DESC, u.created_at DESC`
    )
    .all() as Array<{
    id: string;
    username: string;
    display_name: string;
    avatar_color: string;
    last_active: number | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarColor: r.avatar_color,
    lastActive: r.last_active ?? undefined,
  }));
}

export function updateUser(
  userId: string,
  data: {
    displayName?: string;
    avatarColor?: string;
    password?: string;
  },
  db: Database.Database = openMainDb()
): User {
  const user = getUserById(userId, db);
  if (!user) {
    throw new Error("User not found");
  }

  const now = Date.now();
  const displayName = data.displayName?.trim() || user.displayName;
  const avatarColor = data.avatarColor || user.avatarColor;

  if (data.password) {
    if (data.password.length < 3) {
      throw new Error("Password must be at least 3 characters");
    }
    const salt = generateSalt();
    const hash = hashPassword(data.password, salt);
    db.prepare(
      `UPDATE users
       SET display_name = ?, avatar_color = ?, password_hash = ?, salt = ?, updated_at = ?
       WHERE id = ?`
    ).run(displayName, avatarColor, hash, salt, now, userId);
  } else {
    db.prepare(
      `UPDATE users
       SET display_name = ?, avatar_color = ?, updated_at = ?
       WHERE id = ?`
    ).run(displayName, avatarColor, now, userId);
  }

  return {
    ...user,
    displayName,
    avatarColor,
    updatedAt: now,
  };
}

// -------------------------------------------------------------
// Session Management
// -------------------------------------------------------------
const SESSION_TTL_DAYS = 30;

export function createSession(
  userId: string,
  rememberMe: boolean = true,
  db: Database.Database = openMainDb()
): Session {
  const id = crypto.randomUUID();
  const token = generateToken();
  const now = Date.now();
  const expiresAt = rememberMe
    ? now + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
    : now + 24 * 60 * 60 * 1000;

  db.prepare(
    `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, userId, token, expiresAt, now);

  return {
    id,
    userId,
    token,
    expiresAt,
    createdAt: now,
  };
}

export function getSessionUser(
  token: string,
  db: Database.Database = openMainDb()
): { user: User; session: Session } | null {
  if (!token) return null;
  const now = Date.now();

  const row = db
    .prepare(
      `SELECT s.id as session_id, s.user_id, s.token, s.expires_at, s.created_at as session_created_at,
              u.id as u_id, u.username, u.display_name, u.avatar_color, u.created_at as u_created_at, u.updated_at as u_updated_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, now) as
    | {
        session_id: string;
        user_id: string;
        token: string;
        expires_at: number;
        session_created_at: number;
        u_id: string;
        username: string;
        display_name: string;
        avatar_color: string;
        u_created_at: number;
        u_updated_at: number;
      }
    | undefined;

  if (!row) return null;

  return {
    user: {
      id: row.u_id,
      username: row.username,
      displayName: row.display_name,
      avatarColor: row.avatar_color,
      createdAt: row.u_created_at,
      updatedAt: row.u_updated_at,
    },
    session: {
      id: row.session_id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.session_created_at,
    },
  };
}

export function deleteSession(
  token: string,
  db: Database.Database = openMainDb()
): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function deleteAllUserSessions(
  userId: string,
  db: Database.Database = openMainDb()
): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

// -------------------------------------------------------------
// User Settings
// -------------------------------------------------------------
export function getUserSettings(
  userId: string,
  db: Database.Database = openMainDb()
): Record<string, string> {
  const rows = db
    .prepare("SELECT key, value FROM user_settings WHERE user_id = ?")
    .all(userId) as Array<{ key: string; value: string }>;

  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export function setUserSetting(
  userId: string,
  key: string,
  value: string,
  db: Database.Database = openMainDb()
): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO user_settings (user_id, key, value, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(userId, key, value, now);
}

// -------------------------------------------------------------
// User Conversations Sync ("save everything" in SQLite)
// -------------------------------------------------------------
export function getUserConversations(
  userId: string,
  db: Database.Database = openMainDb()
): Conversation[] {
  const rows = db
    .prepare(
      `SELECT id, title, messages_json, project_id, created_at, updated_at
       FROM user_conversations
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .all(userId) as Array<{
    id: string;
    title: string;
    messages_json: string;
    project_id: string | null;
    created_at: number;
    updated_at: number;
  }>;

  return rows.map((r) => {
    let messages = [];
    try {
      messages = JSON.parse(r.messages_json);
    } catch {
      messages = [];
    }
    return {
      id: r.id,
      title: r.title,
      messages,
      projectId: r.project_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export function saveUserConversations(
  userId: string,
  conversations: Conversation[],
  db: Database.Database = openMainDb()
): void {
  const upsert = db.prepare(
    `INSERT INTO user_conversations (id, user_id, title, messages_json, project_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       messages_json = excluded.messages_json,
       project_id = excluded.project_id,
       updated_at = excluded.updated_at`
  );

  const deleteOthers = db.prepare(
    `DELETE FROM user_conversations
     WHERE user_id = ? AND id NOT IN (${conversations.map(() => "?").join(",") || "''"})`
  );

  const tx = db.transaction(() => {
    for (const c of conversations) {
      upsert.run(
        c.id,
        userId,
        c.title,
        JSON.stringify(c.messages),
        c.projectId || null,
        c.createdAt || Date.now(),
        c.updatedAt || Date.now()
      );
    }
    if (conversations.length > 0) {
      deleteOthers.run(userId, ...conversations.map((c) => c.id));
    }
  });

  tx();
}
