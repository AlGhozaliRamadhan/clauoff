import path from "node:path";

const CODE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".json",
  ".css",
  ".html",
  ".htm",
  ".rs",
  ".go",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".yml",
  ".yaml",
  ".toml",
  ".sh",
  ".bash",
  ".md",
  ".txt",
  ".csv",
  ".xml",
  ".sql",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".scala",
  ".r",
  ".m",
]);

/**
 * Extract plain text from an uploaded file buffer.
 * PDF: text layer only (no OCR in v1 — ADR-0005).
 */
export async function extractText(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const lower = filename.toLowerCase();
  const ext = path.extname(lower);

  if (mimeType === "application/pdf" || ext === ".pdf") {
    // Dynamic import keeps pdf-parse out of client bundles.
    const pdfParse = (await import("pdf-parse")).default as (
      data: Buffer,
    ) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    const text = (data.text || "").trim();
    if (!text) {
      throw new Error(
        "No extractable text in PDF (OCR not supported in v1).",
      );
    }
    return text;
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "application/javascript" ||
    mimeType === "application/typescript" ||
    CODE_EXT.has(ext)
  ) {
    return buffer.toString("utf8");
  }

  throw new Error(
    `Unsupported file type: ${mimeType || ext || "unknown"}. v1 supports markdown, plain text, code, and text-layer PDFs.`,
  );
}
