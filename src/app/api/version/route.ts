import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

// Unique timestamp generated when the Next.js server instance starts
const SERVER_BOOT_TIME = Date.now();

export async function GET() {
  let buildId = "";
  try {
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
      buildId = fs.readFileSync(buildIdPath, "utf8").trim();
    }
  } catch {
    // Fallback if BUILD_ID not available in dev mode
  }

  return NextResponse.json({
    version: "0.1.0",
    buildId: buildId || `boot-${SERVER_BOOT_TIME}`,
    serverBootTime: SERVER_BOOT_TIME,
  });
}
