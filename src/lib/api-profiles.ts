import fs from 'node:fs';
import path from 'node:path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'cogito-config.json');

export interface ApiProfile {
  id: string;
  name: string;
  backendUrl: string;
  apiKey: string;
  defaultModel: string;
  imageModel?: string;
}

export interface StoredConfig {
  profiles: ApiProfile[];
  activeId: string | null;
}

export function readStoredConfig(): StoredConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(raw);

      // Migration: old format had { backendUrl, apiKey, defaultModel } (no profiles array)
      if (!Array.isArray(parsed.profiles)) {
        const migrated: ApiProfile = {
          id: 'migrated-1',
          name: 'My API',
          backendUrl: parsed.backendUrl || '',
          apiKey: parsed.apiKey || '',
          defaultModel: parsed.defaultModel || '',
          imageModel: parsed.imageModel || '',
        };
        return { profiles: [migrated], activeId: 'migrated-1' };
      }

      return {
        profiles: parsed.profiles ?? [],
        activeId: parsed.activeId ?? null,
      };
    }
  } catch {
    // Fall through on corrupt file
  }
  return { profiles: [], activeId: null };
}

export function writeStoredConfig(config: StoredConfig): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Returns the URL/key/model from the active profile,
 * falling back to .env.local values if no profiles exist.
 */
export function getActiveBackendConfig(): {
  backendUrl: string;
  apiKey: string;
  defaultModel: string;
  imageModel: string;
  profileId?: string;
  profileName?: string;
} {
  const stored = readStoredConfig();
  const active =
    stored.profiles.find((p) => p.id === stored.activeId) ??
    stored.profiles[0];

  const defaultUrlFallback = process.env.BACKEND_BASE_URL || 'http://localhost:1234/v1';

  if (active) {
    return {
      backendUrl: active.backendUrl?.trim() || defaultUrlFallback,
      apiKey: active.apiKey || process.env.BACKEND_API_KEY || '',
      defaultModel: active.defaultModel || process.env.DEFAULT_MODEL || '',
      imageModel: active.imageModel?.trim() || process.env.IMAGE_MODEL || '',
      profileId: active.id,
      profileName: active.name,
    };
  }

  return {
    backendUrl: defaultUrlFallback,
    apiKey: process.env.BACKEND_API_KEY || '',
    defaultModel: process.env.DEFAULT_MODEL || '',
    imageModel: process.env.IMAGE_MODEL || '',
    profileId: undefined,
    profileName: undefined,
  };
}

/**
 * Switches the active profile in stored configuration.
 */
export function setActiveProfileId(profileId: string): boolean {
  const stored = readStoredConfig();
  const profileExists = stored.profiles.some((p) => p.id === profileId);
  if (!profileExists) return false;

  writeStoredConfig({
    ...stored,
    activeId: profileId,
  });
  return true;
}
