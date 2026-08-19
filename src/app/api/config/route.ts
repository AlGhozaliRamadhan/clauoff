import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const CONFIG_FILE = path.join(process.cwd(), "data", "cogito-config.json");

export interface ApiProfile {
  id: string;
  name: string;
  backendUrl: string;
  apiKey: string;
  defaultModel: string;
}

interface StoredConfig {
  profiles: ApiProfile[];
  activeId: string | null;
}

function readStoredConfig(): StoredConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);

      // Migration: old format had { backendUrl, apiKey, defaultModel } (no profiles array)
      if (!Array.isArray(parsed.profiles)) {
        const migrated: ApiProfile = {
          id: "migrated-1",
          name: "My API",
          backendUrl: parsed.backendUrl || "",
          apiKey: parsed.apiKey || "",
          defaultModel: parsed.defaultModel || "",
        };
        return { profiles: [migrated], activeId: "migrated-1" };
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

function writeStoredConfig(config: StoredConfig): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Returns the URL/key/model from the active profile,
 * falling back to .env.local values if no profiles exist.
 */
export function getActiveBackendConfig(): {
  backendUrl: string;
  apiKey: string;
  defaultModel: string;
} {
  const stored = readStoredConfig();
  const active =
    stored.profiles.find((p) => p.id === stored.activeId) ??
    stored.profiles[0];

  if (active) {
    return {
      backendUrl:
        active.backendUrl || process.env.BACKEND_BASE_URL || "http://localhost:11434",
      apiKey: active.apiKey || process.env.BACKEND_API_KEY || "",
      defaultModel: active.defaultModel || process.env.DEFAULT_MODEL || "",
    };
  }

  return {
    backendUrl: process.env.BACKEND_BASE_URL || "http://localhost:11434",
    apiKey: process.env.BACKEND_API_KEY || "",
    defaultModel: process.env.DEFAULT_MODEL || "",
  };
}

export async function GET() {
  const stored = readStoredConfig();
  return NextResponse.json({
    profiles: stored.profiles,
    activeId: stored.activeId,
    // Expose env defaults so the UI can show them as reference
    envBackendUrl: process.env.BACKEND_BASE_URL || "",
    envDefaultModel: process.env.DEFAULT_MODEL || "",
  });
}

export async function POST(request: Request) {
  let body: { profiles?: ApiProfile[]; activeId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const next: StoredConfig = {
    profiles: Array.isArray(body.profiles) ? body.profiles : [],
    activeId: body.activeId ?? null,
  };

  try {
    writeStoredConfig(next);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Write failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
