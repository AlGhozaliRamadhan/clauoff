export type VoiceSessionStatus =
  | "idle"
  | "preparing"
  | "listening"
  | "hearing"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export interface VoiceSessionUiState {
  enabled: boolean;
  status: VoiceSessionStatus;
  level: number;
  hint: string | null;
  error: string | null;
  lastTranscript: string | null;
  toggle: () => Promise<void>;
  stop: () => Promise<void>;
}

export function getVoiceSessionHint(
  status: VoiceSessionStatus,
  modelPreparing = false,
  error: string | null = null,
): string | null {
  switch (status) {
    case "preparing":
      return "Preparing hands-free voice…";
    case "listening":
      return modelPreparing
        ? "Listening • local speech model is warming up"
        : "Listening • speak naturally";
    case "hearing":
      return "I hear you…";
    case "transcribing":
      return modelPreparing
        ? "Transcribing locally • first setup can take a minute"
        : "Transcribing locally…";
    case "thinking":
      return "Cogito is thinking…";
    case "speaking":
      return "Cogito is speaking • talk to interrupt";
    case "error":
      return error || "Voice mode needs attention.";
    default:
      return null;
  }
}
