import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { AVAILABLE_VOICES, DEFAULT_VOICE_SETTINGS } from "@/lib/audio/types";
import { cleanTextForSpeech } from "@/lib/audio/text-cleaner";
import { encodeWav } from "@/lib/audio/voice-fx";
import { synthesizeSpeechTs } from "@/lib/audio/kokoro-tts";

export const runtime = "nodejs";

const AUDIO_CACHE_DIR = path.join(process.cwd(), "data", "audio-cache");

// Ensure cache directory exists
function ensureCacheDir() {
  if (!fs.existsSync(AUDIO_CACHE_DIR)) {
    fs.mkdirSync(AUDIO_CACHE_DIR, { recursive: true });
  }
}

/**
 * Generate a deterministic hash for caching audio files
 */
function getCacheKey(text: string, voice: string, speed: number, fx: boolean): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ text, voice, speed: Math.round(speed * 100) / 100, fx }))
    .digest("hex");
}

export async function GET() {
  ensureCacheDir();

  let cachedFileCount = 0;
  try {
    const files = await fs.promises.readdir(AUDIO_CACHE_DIR);
    cachedFileCount = files.filter((f) => f.endsWith(".wav")).length;
  } catch {
    cachedFileCount = 0;
  }

  return NextResponse.json({
    status: "ok",
    engine: "kokoro-ts-neural",
    defaultVoice: DEFAULT_VOICE_SETTINGS.voiceId,
    defaultSpeed: DEFAULT_VOICE_SETTINGS.speed,
    defaultFx: DEFAULT_VOICE_SETTINGS.fxEnabled,
    voices: AVAILABLE_VOICES,
    cachedFiles: cachedFileCount,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = (body.text || "").toString();
    const voice = (body.voice || DEFAULT_VOICE_SETTINGS.voiceId).toString();
    const speed = typeof body.speed === "number" ? body.speed : DEFAULT_VOICE_SETTINGS.speed;
    const fx = typeof body.fx === "boolean" ? body.fx : DEFAULT_VOICE_SETTINGS.fxEnabled;

    const cleanedText = cleanTextForSpeech(rawText);
    if (!cleanedText) {
      // Return 0.2s of silence
      const silenceWav = encodeWav(new Float32Array(4800), 24000);
      return new Response(silenceWav as BodyInit, {
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "no-cache",
        },
      });
    }

    ensureCacheDir();
    const cacheKey = getCacheKey(cleanedText, voice, speed, fx);
    const cachedFilePath = path.join(AUDIO_CACHE_DIR, `${cacheKey}.wav`);

    // 1. Check disk cache
    if (fs.existsSync(cachedFilePath)) {
      const cachedBuf = await fs.promises.readFile(cachedFilePath);
      return new Response(cachedBuf as BodyInit, {
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Audio-Cached": "true",
        },
      });
    }

    // 2. Synthesize using pure TypeScript Kokoro Neural TTS + Cogito DSP FX
    const audioBuffer = await synthesizeSpeechTs(cleanedText, voice, speed, fx);
    if (audioBuffer && audioBuffer.length > 0) {
      fs.promises.writeFile(cachedFilePath, audioBuffer).catch(() => {});
      return new Response(audioBuffer as BodyInit, {
        headers: {
          "Content-Type": "audio/wav",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Audio-Cached": "false",
        },
      });
    }

    // 3. Fallback to client synthesis if needed
    return NextResponse.json({
      fallback: "client",
      text: cleanedText,
      voice,
      speed,
      fx,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to generate audio";
    console.error("Audio route error:", errorMsg);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 },
    );
  }
}
