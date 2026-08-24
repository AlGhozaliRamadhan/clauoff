import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import { getSessionUser } from "./db";
import type { User, Session } from "./types";

export const SESSION_COOKIE_NAME = "cogito_session";

export async function getCurrentUser(
  req?: NextRequest
): Promise<{ user: User; session: Session } | null> {
  let token: string | undefined;

  // 1. Check Authorization header
  if (req) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7).trim();
    }
  }

  // 2. Check cookies
  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    } catch {
      // If called outside request context or before headers parsed
      if (req) {
        token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      }
    }
  }

  if (!token) return null;

  return getSessionUser(token);
}
