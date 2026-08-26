/**
 * src/lib/audio/types.ts
 * Types and voice definitions for Cogito's audio and voice system.
 */

export interface VoiceOption {
  id: string;
  name: string;
  gender: "male" | "female";
  description: string;
  accent?: string;
  previewText?: string;
}

export interface VoiceSettings {
  voiceId: string;
  speed: number;
  fxEnabled: boolean;
  volume: number;
  autoPlay: boolean;
  engine?: "instant" | "neural";
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceId: "am_adam",
  speed: 0.85,
  fxEnabled: true,
  volume: 0.70,
  autoPlay: false,
  engine: "instant",
};

export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: "am_adam",
    name: "Cogito (Deep Transmission)",
    gender: "male",
    description: "Deep, resonant, signature cold transmission tone — Cogito default.",
    accent: "American",
    previewText: "Cogito online. Distant transmission established.",
  },
  {
    id: "bm_george",
    name: "Cogito UK (Gritty Broadcast)",
    gender: "male",
    description: "Gritty British broadcast timbre with metallic resonance.",
    accent: "British",
    previewText: "Signal received loud and clear across the channel.",
  },
  {
    id: "af_heart",
    name: "Cogito Calm (Nuanced Female)",
    gender: "female",
    description: "Calm, nuanced female broadcast presence.",
    accent: "American",
    previewText: "Systems operational. I am ready to assist you.",
  },
  {
    id: "am_michael",
    name: "Cogito Direct (Articulate)",
    gender: "male",
    description: "Crisp, articulate delivery with detached analytical tone.",
    accent: "American",
    previewText: "Analyzing incoming parameters and contextual data.",
  },
  {
    id: "af_bella",
    name: "Cogito Clear (Female Broadcast)",
    gender: "female",
    description: "Clear, structured female voice with high transmission clarity.",
    accent: "American",
    previewText: "Synthesizing response for the requested query.",
  },
  {
    id: "am_echo",
    name: "Cogito Echo (Atmospheric)",
    gender: "male",
    description: "Atmospheric, drifting acoustic timbre.",
    accent: "American",
    previewText: "Carrier frequency unstable. Relaying transmission.",
  },
  {
    id: "am_fenrir",
    name: "Cogito Heavy (Low-End Bass)",
    gender: "male",
    description: "Deep low-end harmonic weight with intense presence.",
    accent: "American",
    previewText: "Neural weights initialized. Processing input stream.",
  },
  {
    id: "am_puck",
    name: "Cogito Fast (Crisp)",
    gender: "male",
    description: "Fast, energetic transmission delivery.",
    accent: "American",
    previewText: "Ready for rapid calculation and immediate delivery.",
  },
  {
    id: "bm_fable",
    name: "Cogito Textured (British Deep)",
    gender: "male",
    description: "Rich, textured British delivery.",
    accent: "British",
    previewText: "Reflecting on the deeper implications of the premise.",
  },
];

export interface SynthesizeRequestBody {
  text: string;
  voice?: string;
  speed?: number;
  fx?: boolean;
}

export interface VoiceStatusResponse {
  status: "ok" | "degraded";
  engine: string;
  voices: VoiceOption[];
  defaultVoice: string;
  serverConnected: boolean;
}
