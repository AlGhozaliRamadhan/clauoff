import { NextResponse } from "next/server";
import { listSkills, saveSkill, CURATED_SKILLS } from "@/lib/skills";

export const runtime = "nodejs";

/**
 * GET /api/skills
 * Returns all installed skills and curated catalog items.
 */
export async function GET() {
  try {
    const skills = await listSkills();
    const totalInstalled = skills.length;
    const totalEnabled = skills.filter((s) => s.enabled).length;

    return NextResponse.json({
      skills,
      curated: CURATED_SKILLS,
      totalInstalled,
      totalEnabled,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load skills";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/skills
 * Creates or updates a skill.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.name) {
      return NextResponse.json(
        { error: "Skill `name` is required." },
        { status: 400 }
      );
    }

    const saved = await saveSkill({
      name: body.name,
      description: body.description,
      content: body.content,
      instructions: body.instructions,
      license: body.license,
      compatibility: body.compatibility,
      metadata: body.metadata,
      allowedTools: body.allowedTools,
      enabled: body.enabled !== false,
      source: body.source || "custom",
      sourceUrl: body.sourceUrl,
    });

    return NextResponse.json({ skill: saved }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save skill";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
