import { NextRequest, NextResponse } from "next/server";
import { getActiveBackendConfig } from "@/lib/api-profiles";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("file") || formData.get("audio");

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json(
        { error: "No audio file provided in form data." },
        { status: 400 },
      );
    }

    const { backendUrl, apiKey } = getActiveBackendConfig();
    const cleanUrl = backendUrl.replace(/\/+$/, "");

    // Prioritize standard OpenAI / Whisper endpoints
    const possibleEndpoints: string[] = [];
    if (cleanUrl.endsWith("/v1")) {
      possibleEndpoints.push(`${cleanUrl}/audio/transcriptions`);
      possibleEndpoints.push(`${cleanUrl.replace(/\/v1$/, "")}/audio/transcriptions`);
    } else {
      possibleEndpoints.push(`${cleanUrl}/v1/audio/transcriptions`);
      possibleEndpoints.push(`${cleanUrl}/audio/transcriptions`);
    }

    let lastError = "";

    for (const endpoint of possibleEndpoints) {
      try {
        const proxyForm = new FormData();
        const ext = audioFile.type.includes("wav")
          ? "wav"
          : audioFile.type.includes("ogg")
          ? "ogg"
          : audioFile.type.includes("mp4")
          ? "m4a"
          : "webm";
        proxyForm.append("file", audioFile, `recording.${ext}`);
        proxyForm.append("model", "whisper-1");
        proxyForm.append("language", "en");

        const headers: Record<string, string> = {};
        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: proxyForm,
          signal: AbortSignal.timeout(20000),
        });

        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            text: (data.text || data.transcript || "").trim(),
          });
        } else {
          const errText = await res.text().catch(() => "");
          lastError = `Backend returned ${res.status}: ${errText}`;
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Failed to reach transcription endpoint";
      }
    }

    return NextResponse.json(
      {
        error: lastError || "Local backend transcription is not running. Ensure your backend has Whisper or audio transcription enabled.",
      },
      { status: 502 },
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process audio transcription" },
      { status: 500 },
    );
  }
}
