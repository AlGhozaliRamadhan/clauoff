import { NextResponse, type NextRequest } from "next/server";
import { deleteSession } from "@/lib/auth/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const auth = await getCurrentUser(req);
    if (auth) {
      deleteSession(auth.session.token);
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Logout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
