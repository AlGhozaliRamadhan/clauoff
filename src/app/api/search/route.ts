import { NextResponse } from "next/server";
import { webSearch } from "@/lib/web-search";

export const runtime = "nodejs";

/**
 * POST /api/search — Perform a web search.
 * Body: { query: string, maxResults?: number }
 * Returns: { results: SearchResult[] }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.query !== "string" || !body.query.trim()) {
    return NextResponse.json(
      { error: "Request body must include a non-empty `query` string." },
      { status: 400 },
    );
  }

  try {
    const results = await webSearch(body.query, body.maxResults ?? 5);
    return NextResponse.json({ results });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
