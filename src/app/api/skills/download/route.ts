import { NextResponse } from "next/server";
import { downloadSkillFromUrl } from "@/lib/skills";

export const runtime = "nodejs";

/**
 * POST /api/skills/download
 * Body: { url: string, name?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.url || typeof body.url !== "string") {
      return NextResponse.json(
        { error: "A valid `url` string is required in request body." },
        { status: 400 }
      );
    }

    const downloaded = await downloadSkillFromUrl(body.url.trim(), body.name);

    return NextResponse.json({
      success: true,
      skill: downloaded,
      message: `Successfully downloaded and installed skill "${downloaded.name}".`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Download failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
