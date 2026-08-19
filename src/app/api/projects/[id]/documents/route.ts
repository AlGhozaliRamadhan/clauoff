import { NextResponse } from "next/server";
import { ingestFile } from "@/lib/rag/ingest";
import { getProject, listDocuments } from "@/lib/rag/projects";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

const MAX_BYTES = 10 * 1024 * 1024;

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!getProject(id)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const documents = listDocuments(id);
    return NextResponse.json({ documents });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list documents.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!getProject(id)) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Multipart form field "file" is required.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 10 MB upload limit." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestFile(id, {
      buffer,
      filename: file.name || "upload",
      mimeType: file.type || "application/octet-stream",
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ingest failed.";
    // 422 for extract/embed failures; 404 already handled above
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
