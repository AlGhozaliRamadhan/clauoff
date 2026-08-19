import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/rag/projects";

export const runtime = "nodejs";

export async function GET() {
  try {
    const projects = listProjects();
    return NextResponse.json({ projects });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list projects.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Request body must include a `name` string." },
        { status: 400 },
      );
    }
    const description =
      typeof body.description === "string" ? body.description : undefined;
    const project = createProject(body.name, description);
    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create project.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
