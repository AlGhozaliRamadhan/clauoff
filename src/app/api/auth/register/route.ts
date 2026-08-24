import { NextResponse, type NextRequest } from "next/server";
import { createUser, createSession, getUserSettings } from "@/lib/auth/db";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, displayName, avatarColor, rememberMe = true } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = createUser({
      username,
      password,
      displayName,
      avatarColor,
    });

    const session = createSession(user.id, rememberMe);
    const settings = getUserSettings(user.id);

    const response = NextResponse.json({
      user,
      token: session.token,
      settings,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: session.token,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
    });

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
