import fs from "fs";
import path from "path";
import { KokoroTTS } from "kokoro-js";
import { Tensor } from "@huggingface/transformers";
import { phonemize } from "phonemizer";
import { cleanTextForSpeech } from "./text-cleaner";
import { encodeWav, processCogitoVoice } from "./voice-fx";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initPromise: Promise<any> | null = null;

// Fast in-memory caches
const memoryCache = new Map<string, Buffer>();
const voiceTensorCache = new Map<string, Float32Array>();
const phonemeCache = new Map<string, string>();
const MAX_MEMORY_CACHE = 300;

/**
 * Loads a voice .bin tensor safely from disk or remote CDN without Webpack __dirname path issues.
 */
export async function loadVoiceTensor(voiceName: string): Promise<Float32Array> {
  if (voiceTensorCache.has(voiceName)) {
    return voiceTensorCache.get(voiceName)!;
  }

  const possiblePaths = [
    path.join(process.cwd(), "node_modules", "kokoro-js", "voices", `${voiceName}.bin`),
    path.join(process.cwd(), "data", "voices", `${voiceName}.bin`),
  ];

  let buffer: Buffer | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      try {
        buffer = await fs.promises.readFile(/*turbopackIgnore: true*/ p);
        break;
      } catch {
        // Try next path
      }
    }
  }

  if (!buffer) {
    // Fallback: download voice vector directly from HuggingFace CDN
    const url = `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/voices/${voiceName}.bin`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download voice tensor for ${voiceName}: ${res.statusText}`);
    }
    const ab = await res.arrayBuffer();
    buffer = Buffer.from(ab);
  }

  const float32 = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  voiceTensorCache.set(voiceName, float32);
  return float32;
}

/**
 * Returns a cached singleton instance of KokoroTTS in Node.js runtime.
 */
export async function getKokoroInstance() {
  if (ttsInstance) return ttsInstance;
  if (!initPromise) {
    initPromise = KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8",
    })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(async (instance: any) => {
        ttsInstance = instance;
        return instance;
      })
      .catch((err: unknown) => {
        initPromise = null;
        throw err;
      });
  }
  return initPromise;
}

// Background eager warmup so first user click is instant
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  setTimeout(() => {
    getKokoroInstance().catch(() => {});
    ["am_adam", "bm_george", "af_heart", "am_michael", "af_bella"].forEach((v) => {
      loadVoiceTensor(v).catch(() => {});
    });
    // Pre-synthesize short opening phrases in memory cache for 0ms immediate responses
    const commonOpenings = ["Cogito online.", "Sure.", "Understood.", "Certainly.", "Systems operational."];
    commonOpenings.forEach((op) => {
      synthesizeSpeechTs(op, "am_adam", 0.85, true).catch(() => {});
    });
  }, 200);
}

/**
 * Synthesizes neural speech completely in pure TypeScript/Node.js using Cogito TTS
 * and applies the vintage transmission DSP FX chain.
 */
export async function synthesizeSpeechTs(
  text: string,
  voice: string = "am_adam",
  speed: number = 0.85,
  fx: boolean = true,
): Promise<Buffer> {
  const clean = cleanTextForSpeech(text);
  if (!clean) {
    const silence = new Float32Array(4800);
    return Buffer.from(encodeWav(silence, 24000));
  }

  const cacheKey = `${clean}|${voice}|${Math.round(speed * 100) / 100}|${fx}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const [tts, voiceData] = await Promise.all([
    getKokoroInstance(),
    loadVoiceTensor(voice),
  ]);

  // Phonemize text with fast in-memory cache
  const langCode = voice.startsWith("b") ? "en-gb" : "en-us";
  const phonemeKey = `${clean}|${langCode}`;
  let phonemes = phonemeCache.get(phonemeKey);
  if (!phonemes) {
    phonemes = (await phonemize(clean, langCode)).join(" ");
    phonemeCache.set(phonemeKey, phonemes);
  }

  // Tokenize
  const { input_ids } = tts.tokenizer(phonemes, { truncation: true });

  // Slice style tensor for this sentence length
  const n = 256 * Math.min(Math.max(input_ids.dims.at(-1) - 2, 0), 509);
  const styleSlice = voiceData.slice(n, n + 256);

  // Run neural model
  const modelInputs = {
    input_ids,
    style: new Tensor("float32", styleSlice, [1, 256]),
    speed: new Tensor("float32", [speed], [1]),
  };

  const { waveform } = await tts.model(modelInputs);
  const rawData: Float32Array = waveform.data;
  const sampleRate = 24000;

  let processed: Float32Array;
  if (fx) {
    // Add subtle 0.1s tail for resonance decay without introducing gaps between streaming sentences
    const silenceSamples = Math.floor(0.1 * sampleRate);
    const padded = new Float32Array(rawData.length + silenceSamples);
    padded.set(rawData);
    processed = processCogitoVoice(padded, sampleRate);
  } else {
    // Normalize peak to 0.95
    processed = new Float32Array(rawData.length);
    let maxAbs = 0;
    for (let i = 0; i < rawData.length; i++) {
      const abs = Math.abs(rawData[i]);
      if (abs > maxAbs) maxAbs = abs;
    }
    const scale = maxAbs > 1e-6 ? 0.95 / maxAbs : 1.0;
    for (let i = 0; i < rawData.length; i++) {
      processed[i] = rawData[i] * scale;
    }
  }

  const wavArrayBuffer = encodeWav(processed, sampleRate);
  const buffer = Buffer.from(wavArrayBuffer);

  // Store in fast memory cache
  if (memoryCache.size >= MAX_MEMORY_CACHE) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(cacheKey, buffer);

  return buffer;
}
