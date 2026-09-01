import fs from "node:fs";
import path from "node:path";
import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipelineType,
} from "@huggingface/transformers";

const DEFAULT_STT_MODEL = "onnx-community/whisper-tiny";
const DEFAULT_STT_REVISION = "ff4177021cc41f7db950912b73ea4fdf7d01d8e7";
const STT_CACHE_DIR = path.join(process.cwd(), "data", "models", "transformers-cache");

export interface LocalSttStatus {
  state: "idle" | "loading" | "ready" | "error";
  model: string;
  progress: number | null;
  file: string | null;
  error: string | null;
}

let transcriber: AutomaticSpeechRecognitionPipelineType | null = null;
let transcriberPromise: Promise<AutomaticSpeechRecognitionPipelineType> | null = null;
let localSttStatus: LocalSttStatus = {
  state: "idle",
  model: process.env.COGITO_STT_MODEL || DEFAULT_STT_MODEL,
  progress: null,
  file: null,
  error: null,
};

function configureModelCache() {
  fs.mkdirSync(STT_CACHE_DIR, { recursive: true });
  env.cacheDir = STT_CACHE_DIR;
  env.useFSCache = true;
  // Remote access is used only while a user explicitly prepares voice mode.
  // Once present, Transformers.js resolves every model file from this cache.
  env.allowRemoteModels = true;
}

export function getLocalSttStatus(): LocalSttStatus {
  return { ...localSttStatus };
}

export function hasLocalSttCache(): boolean {
  try {
    const model = process.env.COGITO_STT_MODEL || DEFAULT_STT_MODEL;
    const revision = process.env.COGITO_STT_REVISION || DEFAULT_STT_REVISION;
    const modelDir = path.join(STT_CACHE_DIR, ...model.split("/"), revision);
    const onnxDir = path.join(modelDir, "onnx");
    return fs.existsSync(path.join(modelDir, "config.json"))
      && fs.existsSync(onnxDir)
      && fs.readdirSync(onnxDir).some((file) => file.endsWith(".onnx"));
  } catch {
    return false;
  }
}

export async function warmLocalTranscriber(): Promise<AutomaticSpeechRecognitionPipelineType> {
  if (transcriber) return transcriber;
  if (transcriberPromise) return transcriberPromise;

  configureModelCache();
  const model = process.env.COGITO_STT_MODEL || DEFAULT_STT_MODEL;
  const revision = process.env.COGITO_STT_REVISION || DEFAULT_STT_REVISION;

  localSttStatus = {
    state: "loading",
    model,
    progress: 0,
    file: null,
    error: null,
  };

  transcriberPromise = pipeline("automatic-speech-recognition", model, {
    dtype: "q8",
    revision,
    cache_dir: STT_CACHE_DIR,
    progress_callback: (progress) => {
      const progressValue = "progress" in progress && typeof progress.progress === "number"
        ? Math.max(0, Math.min(100, Math.round(progress.progress)))
        : localSttStatus.progress;
      const file = "file" in progress && typeof progress.file === "string"
        ? progress.file
        : localSttStatus.file;
      localSttStatus = {
        ...localSttStatus,
        progress: progressValue,
        file,
      };
    },
  })
    .then((loaded) => {
      transcriber = loaded;
      localSttStatus = {
        state: "ready",
        model,
        progress: 100,
        file: null,
        error: null,
      };
      return loaded;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to load local speech recognition";
      transcriberPromise = null;
      localSttStatus = {
        state: "error",
        model,
        progress: null,
        file: null,
        error: message,
      };
      throw error;
    });

  return transcriberPromise;
}

export function sanitizeTranscript(value: string): string {
  const text = value
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/^\[(?:blank_audio|silence|music|noise)\]$/i, "")
    .trim();
  // Tiny Whisper models commonly hear the product name as a similar word.
  // Limit correction to a leading vocative so normal uses of those words stay intact.
  return text.replace(/^(?:cognito|continental)\s*([,:])\s*/i, "Cogito$1 ");
}

export async function transcribeLocalAudio(
  audio: Float32Array,
  language?: string,
): Promise<string> {
  if (audio.length < 1_600) return "";

  let energy = 0;
  for (let i = 0; i < audio.length; i++) {
    const sample = Number.isFinite(audio[i]) ? Math.max(-1, Math.min(1, audio[i])) : 0;
    audio[i] = sample;
    energy += sample * sample;
  }
  const rms = Math.sqrt(energy / audio.length);
  if (rms < 0.003) return "";

  const activeTranscriber = await warmLocalTranscriber();
  const normalizedLanguage = language?.trim().toLowerCase().split("-")[0];
  const output = await activeTranscriber(audio, {
    task: "transcribe",
    chunk_length_s: 30,
    stride_length_s: 5,
    ...(normalizedLanguage && normalizedLanguage !== "auto"
      ? { language: normalizedLanguage }
      : {}),
  });

  const results = Array.isArray(output) ? output : [output];
  return sanitizeTranscript(results.map((item) => item.text).join(" "));
}
