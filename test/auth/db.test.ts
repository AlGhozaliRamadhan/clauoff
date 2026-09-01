import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import {
  openMainDb,
  createUser,
  authenticateUser,
  createSession,
  getSessionUser,
  deleteSession,
  listPublicUsers,
  updateUser,
  getUserSettings,
  setUserSetting,
  getUserConversations,
  saveUserConversations,
  hashPassword,
  generateSalt,
} from "@/lib/auth/db";

describe("Auth SQLite Database", () => {
  let db: Database.Database;

  beforeEach(() => {
    // In-memory test database
    db = openMainDb(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("hashes passwords consistently with given salt", () => {
    const salt = generateSalt();
    const hash1 = hashPassword("secret123", salt);
    const hash2 = hashPassword("secret123", salt);
    const hash3 = hashPassword("different", salt);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it("creates and authenticates a user", () => {
    const user = createUser(
      {
        username: "johndoe",
        password: "password123",
        displayName: "John Doe",
      },
      db
    );

    expect(user.id).toBeDefined();
    expect(user.username).toBe("johndoe");
    expect(user.displayName).toBe("John Doe");

    // Successful authentication
    const authUser = authenticateUser("johndoe", "password123", db);
    expect(authUser).not.toBeNull();
    expect(authUser?.id).toBe(user.id);
    expect(authUser?.username).toBe("johndoe");

    // Case-insensitive username match
    const authUserUpper = authenticateUser("JohnDoe", "password123", db);
    expect(authUserUpper).not.toBeNull();
    expect(authUserUpper?.id).toBe(user.id);

    // Wrong password
    const failedAuth = authenticateUser("johndoe", "wrongpass", db);
    expect(failedAuth).toBeNull();

    // Non-existent user
    const nonExistent = authenticateUser("unknown", "password123", db);
    expect(nonExistent).toBeNull();
  });

  it("prevents duplicate username registration", () => {
    createUser(
      {
        username: "unique_user",
        password: "password123",
      },
      db
    );

    expect(() =>
      createUser(
        {
          username: "unique_user",
          password: "password456",
        },
        db
      )
    ).toThrow(/already exists/i);

    expect(() =>
      createUser(
        {
          username: "UNIQUE_USER",
          password: "password456",
        },
        db
      )
    ).toThrow(/already exists/i);
  });

  it("creates, validates, and deletes sessions", () => {
    const user = createUser(
      {
        username: "session_user",
        password: "pass12345",
      },
      db
    );

    const session = createSession(user.id, true, db);
    expect(session.token).toBeDefined();
    expect(session.userId).toBe(user.id);

    // Validate session
    const sessionData = getSessionUser(session.token, db);
    expect(sessionData).not.toBeNull();
    expect(sessionData?.user.id).toBe(user.id);
    expect(sessionData?.session.token).toBe(session.token);

    // Delete session (logout)
    deleteSession(session.token, db);
    const sessionAfterDelete = getSessionUser(session.token, db);
    expect(sessionAfterDelete).toBeNull();
  });

  it("lists public users for local account switcher", () => {
    createUser(
      {
        username: "alice",
        password: "pass12345",
        displayName: "Alice Wonderland",
      },
      db
    );

    createUser(
      {
        username: "bob",
        password: "pass12345",
        displayName: "Bob Builder",
      },
      db
    );

    const users = listPublicUsers(db);
    expect(users.length).toBe(2);
    expect(users.some((u) => u.username === "alice")).toBe(true);
    expect(users.some((u) => u.username === "bob")).toBe(true);
  });

  it("updates user profile and settings", () => {
    const user = createUser(
      {
        username: "updater",
        password: "oldpassword",
        displayName: "Old Name",
      },
      db
    );

    const updated = updateUser(
      user.id,
      {
        displayName: "New Name",
        avatarColor: "#059669",
        password: "newpassword",
      },
      db
    );

    expect(updated.displayName).toBe("New Name");
    expect(updated.avatarColor).toBe("#059669");

    // Authenticate with new password
    expect(authenticateUser("updater", "oldpassword", db)).toBeNull();
    expect(authenticateUser("updater", "newpassword", db)).not.toBeNull();

    // User settings
    setUserSetting(user.id, "theme", "dark", db);
    setUserSetting(user.id, "model", "llama3.2", db);

    const settings = getUserSettings(user.id, db);
    expect(settings.theme).toBe("dark");
    expect(settings.model).toBe("llama3.2");
  });

  it("saves and retrieves user conversations in SQLite", () => {
    const user = createUser(
      {
        username: "chatter",
        password: "password",
      },
      db
    );

    const convs = [
      {
        id: "conv-1",
        title: "First Conversation",
        messages: [
          { id: "m1", role: "user" as const, content: "Hello" },
          { id: "m2", role: "assistant" as const, content: "Hi there!" },
        ],
        createdAt: 1000,
        updatedAt: 1500,
      },
      {
        id: "conv-2",
        title: "Second Conversation",
        messages: [
          { id: "m3", role: "user" as const, content: "What is Cogito?" },
        ],
        createdAt: 2000,
        updatedAt: 2500,
      },
    ];

    saveUserConversations(user.id, convs, db);

    const retrieved = getUserConversations(user.id, db);
    expect(retrieved.length).toBe(2);
    expect(retrieved[0].title).toBe("Second Conversation"); // Ordered by updatedAt DESC
    expect(retrieved[0].messages.length).toBe(1);
    expect(retrieved[1].title).toBe("First Conversation");
    expect(retrieved[1].messages.length).toBe(2);
  });
});
