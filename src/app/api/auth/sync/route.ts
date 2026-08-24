import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserConversations, saveUserConversations } from "@/lib/auth/db";
import type { Conversation } from "@/lib/conversation-store";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = getUserConversations(auth.user.id);
    return NextResponse.json({ conversations });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to retrieve conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const conversations = (body.conversations ?? []) as Conversation[];

    saveUserConversations(auth.user.id, conversations);

    return NextResponse.json({ success: true, count: conversations.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to sync conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
