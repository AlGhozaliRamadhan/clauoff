import { NextResponse } from "next/server";
import { getSkill, saveSkill, deleteSkill, toggleSkill } from "@/lib/skills";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ name: string }>;
}

/**
 * GET /api/skills/[name]
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { name } = await params;
    const skill = await getSkill(name);
    if (!skill) {
      return NextResponse.json({ error: `Skill not found: ${name}` }, { status: 404 });
    }
    return NextResponse.json({ skill });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to get skill";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PUT /api/skills/[name]
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { name } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body.enabled !== undefined && Object.keys(body).length === 1) {
      // Fast toggle
      const toggled = await toggleSkill(name, !!body.enabled);
      if (!toggled) {
        return NextResponse.json({ error: `Skill not found: ${name}` }, { status: 404 });
      }
      return NextResponse.json({ skill: toggled });
    }

    const saved = await saveSkill({
      name: body.name || name,
      description: body.description,
      content: body.content,
      instructions: body.instructions,
      license: body.license,
      compatibility: body.compatibility,
      metadata: body.metadata,
      allowedTools: body.allowedTools,
      enabled: body.enabled !== undefined ? !!body.enabled : true,
      source: body.source,
      sourceUrl: body.sourceUrl,
    });

    return NextResponse.json({ skill: saved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update skill";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * DELETE /api/skills/[name]
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { name } = await params;
    const deleted = await deleteSkill(name);
    if (!deleted) {
      return NextResponse.json({ error: `Skill not found or could not be deleted: ${name}` }, { status: 404 });
    }
    return NextResponse.json({ success: true, name });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete skill";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
