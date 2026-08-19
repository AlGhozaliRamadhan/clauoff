import { NextResponse } from "next/server";
import {
  deleteProject,
  getProject,
  listDocuments,
  updateProject,
} from "@/lib/rag/projects";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const project = getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const documents = listDocuments(id);
    return NextResponse.json({ project, documents });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load project.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!getProject(id)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 },
      );
    }
    const patch: { name?: string; description?: string } = {};
    if (typeof body.name === "string") patch.name = body.name;
    if (typeof body.description === "string" || body.description === null) {
      patch.description = body.description ?? "";
    }
    const project = updateProject(id, patch);
    return NextResponse.json({ project });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update project.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete project.";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
