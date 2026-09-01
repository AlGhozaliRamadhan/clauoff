import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  readStoredConfig,
  writeStoredConfig,
  getActiveBackendConfig,
  setActiveProfileId,
  type StoredConfig,
} from "@/lib/api-profiles";

describe("api-profiles", () => {
  const originalEnvUrl = process.env.BACKEND_BASE_URL;
  const originalEnvKey = process.env.BACKEND_API_KEY;
  const originalEnvModel = process.env.DEFAULT_MODEL;

  afterEach(() => {
    process.env.BACKEND_BASE_URL = originalEnvUrl;
    process.env.BACKEND_API_KEY = originalEnvKey;
    process.env.DEFAULT_MODEL = originalEnvModel;
  });

  it("reads stored configuration and retrieves active profile", () => {
    const config = readStoredConfig();
    expect(config).toBeDefined();
    expect(Array.isArray(config.profiles)).toBe(true);
  });

  it("retrieves active backend config with fallback", () => {
    const active = getActiveBackendConfig();
    expect(active).toBeDefined();
    expect(typeof active.backendUrl).toBe("string");
    expect(active.backendUrl.length).toBeGreaterThan(0);
  });

  it("switches active profile successfully", () => {
    const current = readStoredConfig();
    if (current.profiles.length > 0) {
      const target = current.profiles[0];
      const success = setActiveProfileId(target.id);
      expect(success).toBe(true);

      const updated = readStoredConfig();
      expect(updated.activeId).toBe(target.id);
    }
  });

  it("returns false when activating non-existent profile", () => {
    const success = setActiveProfileId("non-existent-profile-xyz");
    expect(success).toBe(false);
  });
});
