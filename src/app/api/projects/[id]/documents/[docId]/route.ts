import { NextResponse } from "next/server";
import { deleteDocument, getProject } from "@/lib/rag/projects";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; docId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id, docId } = await context.params;
    if (!getProject(id)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    deleteDocument(id, docId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete document.";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
