import { describe, expect, it } from "vitest";
import { getVoiceSessionHint } from "@/lib/audio/voice-session";

describe("voice session status hints", () => {
  it("describes the complete hands-free turn loop", () => {
    expect(getVoiceSessionHint("listening")).toContain("speak naturally");
    expect(getVoiceSessionHint("hearing")).toContain("hear you");
    expect(getVoiceSessionHint("transcribing")).toContain("Transcribing locally");
    expect(getVoiceSessionHint("thinking")).toContain("thinking");
    expect(getVoiceSessionHint("speaking")).toContain("talk to interrupt");
  });

  it("makes first-run model preparation explicit", () => {
    expect(getVoiceSessionHint("listening", true)).toContain("warming up");
    expect(getVoiceSessionHint("transcribing", true)).toContain("first setup");
  });

  it("surfaces a concrete voice error", () => {
    expect(getVoiceSessionHint("error", false, "Microphone denied"))
      .toBe("Microphone denied");
  });
});
