import { NextRequest, NextResponse } from "next/server";
import { getActiveBackendConfig } from "@/lib/api-profiles";
import {
  getLocalSttStatus,
  hasLocalSttCache,
  transcribeLocalAudio,
  warmLocalTranscriber,
} from "@/lib/audio/local-stt";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const MAX_AUDIO_SAMPLES = 16_000 * 120;

function decodeFloat32Le(buffer: ArrayBuffer): Float32Array {
  if (buffer.byteLength % 4 !== 0) {
    throw new Error("Invalid Float32 microphone audio payload.");
  }
  const sampleCount = buffer.byteLength / 4;
  if (sampleCount > MAX_AUDIO_SAMPLES) {
    throw new Error("Voice turns are limited to two minutes.");
  }
  const view = new DataView(buffer);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = view.getFloat32(i * 4, true);
  }
  return samples;
}

async function transcribeWithActiveBackend(audioFile: Blob): Promise<NextResponse> {
  const { backendUrl, apiKey } = getActiveBackendConfig();
  const cleanUrl = backendUrl.replace(/\/+$/, "");
  const endpoints = cleanUrl.endsWith("/v1")
    ? [`${cleanUrl}/audio/transcriptions`, `${cleanUrl.replace(/\/v1$/, "")}/audio/transcriptions`]
    : [`${cleanUrl}/v1/audio/transcriptions`, `${cleanUrl}/audio/transcriptions`];
  let lastError = "The active backend does not expose audio transcription.";

  for (const url of endpoints) {
    try {
      const form = new FormData();
      form.append("file", audioFile, "recording.wav");
      form.append("model", "whisper-1");
      const response = await fetch(url, {
        method: "POST",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        lastError = `Backend returned ${response.status}.`;
        continue;
      }
      const data = await response.json();
      const text = String(data.text || data.transcript || "").trim();
      if (text) return NextResponse.json({ text, engine: "backend" });
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    }
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}

export async function GET() {
  return NextResponse.json({
    engine: "local-whisper",
    cached: hasLocalSttCache(),
    ...getLocalSttStatus(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body?.action !== "warmup") {
        return NextResponse.json({ error: "Unknown transcription action." }, { status: 400 });
      }
      await warmLocalTranscriber();
      return NextResponse.json({ ok: true, ...getLocalSttStatus() });
    }

    const formData = await req.formData();
    const audioFile = formData.get("file") || formData.get("audio");
    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: "No microphone audio was provided." }, { status: 400 });
    }
    if (audioFile.size <= 0 || audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "The microphone audio payload is empty or too large." }, { status: 413 });
    }

    const engine = String(formData.get("engine") || "local");
    if (engine === "backend") {
      return transcribeWithActiveBackend(audioFile);
    }

    const format = String(formData.get("format") || "");
    const sampleRate = Number(formData.get("sampleRate") || 16_000);
    if (format !== "f32le" || sampleRate !== 16_000) {
      return NextResponse.json(
        { error: "Local transcription expects 16 kHz Float32 microphone audio." },
        { status: 415 },
      );
    }

    const samples = decodeFloat32Le(await audioFile.arrayBuffer());
    const language = String(formData.get("language") || "auto");
    const text = await transcribeLocalAudio(samples, language);
    if (!text) {
      return NextResponse.json(
        { error: "I couldn't hear a clear spoken phrase. Please try again." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text, engine: "local-whisper" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Local transcription failed.";
    console.error("Local transcription error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
