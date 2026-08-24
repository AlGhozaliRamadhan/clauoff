import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getUserSettings, setUserSetting, updateUser } from "@/lib/auth/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const settings = getUserSettings(auth.user.id);
    return NextResponse.json({
      user: auth.user,
      token: auth.session.token,
      settings,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch user";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await getCurrentUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { displayName, avatarColor, password, settings } = body;

    let updatedUser = auth.user;
    if (displayName !== undefined || avatarColor !== undefined || password !== undefined) {
      updatedUser = updateUser(auth.user.id, {
        displayName,
        avatarColor,
        password,
      });
    }

    if (settings && typeof settings === "object") {
      for (const [k, v] of Object.entries(settings)) {
        if (typeof v === "string") {
          setUserSetting(auth.user.id, k, v);
        }
      }
    }

    const updatedSettings = getUserSettings(auth.user.id);

    return NextResponse.json({
      user: updatedUser,
      settings: updatedSettings,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update user";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
