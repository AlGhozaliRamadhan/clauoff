import { describe, expect, it } from "vitest";
import { sanitizeTranscript } from "@/lib/audio/local-stt";

describe("local speech transcript cleanup", () => {
  it("normalizes whitespace without changing spoken wording", () => {
    expect(sanitizeTranscript("  hello   there \n Cogito  ")).toBe("hello there Cogito");
  });

  it("drops Whisper non-speech placeholders", () => {
    expect(sanitizeTranscript("[BLANK_AUDIO]")).toBe("");
    expect(sanitizeTranscript("[music]")).toBe("");
  });

  it("repairs common Cogito wake-name errors only when used as a vocative", () => {
    expect(sanitizeTranscript("Continental, tell me a short joke.")).toBe(
      "Cogito, tell me a short joke.",
    );
    expect(sanitizeTranscript("continental breakfast")).toBe("continental breakfast");
  });
});
