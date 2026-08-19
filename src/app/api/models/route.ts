import { NextResponse } from "next/server";
import { getBackend } from "@/lib/backend-config";

export const runtime = "nodejs";

export async function GET() {
  try {
    const models = await getBackend().listModels();
    return NextResponse.json({ models });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to connect to backend.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
