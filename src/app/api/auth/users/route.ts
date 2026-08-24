import { NextResponse } from "next/server";
import { listPublicUsers } from "@/lib/auth/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const users = listPublicUsers();
    return NextResponse.json({ users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
