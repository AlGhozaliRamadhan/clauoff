import { NextResponse } from "next/server";
import {
  readStoredConfig,
  writeStoredConfig,
  type ApiProfile,
  type StoredConfig,
} from "@/lib/api-profiles";

export const runtime = "nodejs";

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
