import { describe, it, expect } from "vitest";
import {
  processCogitoVoice,
  encodeWav,
  decodeWav,
  applyBandpass,
  applySaturation,
  applyCompression,
  applyNormalize,
} from "@/lib/audio/voice-fx";
import { cleanTextForSpeech, splitTextIntoSpeechChunks } from "@/lib/audio/text-cleaner";

describe("Cogito Voice FX DSP", () => {
  it("processes audio signal through complete pipeline", () => {
    const rate = 24000;
    const durationSec = 0.5;
    const n = Math.floor(rate * durationSec);
    const inputSignal = new Float32Array(n);

    // Create a 440 Hz test sine wave
    for (let i = 0; i < n; i++) {
      inputSignal[i] = Math.sin((2 * Math.PI * 440 * i) / rate) * 0.5;
    }

    const processed = processCogitoVoice(inputSignal, rate);
    expect(processed.length).toBe(n);

    // Verify peak normalization is bounded within softer comfortable listening range
    let maxVal = 0;
    for (let i = 0; i < processed.length; i++) {
      const abs = Math.abs(processed[i]);
      if (abs > maxVal) maxVal = abs;
    }
    expect(maxVal).toBeLessThanOrEqual(0.8);
    expect(maxVal).toBeGreaterThan(0.4);
  });

  it("encodes and decodes WAV files losslessly within 16-bit precision", () => {
    const rate = 24000;
    const samples = new Float32Array([0.0, 0.5, -0.5, 0.9, -0.9, 0.0]);
    const wavBytes = encodeWav(samples, rate);

    expect(wavBytes.length).toBe(44 + samples.length * 2);

    const { samples: decoded, sampleRate } = decodeWav(wavBytes);
    expect(sampleRate).toBe(rate);
    expect(decoded.length).toBe(samples.length);

    for (let i = 0; i < samples.length; i++) {
      expect(Math.abs(decoded[i] - samples[i])).toBeLessThan(0.01);
    }
  });

  it("applies saturation and compression", () => {
    const input = new Float32Array([0.1, 0.5, 0.9, -0.9]);
    const saturated = applySaturation(input, 6.0, 0.8);
    expect(saturated.length).toBe(input.length);

    const compressed = applyCompression(saturated, 0.15, 8.0, 2.0);
    expect(compressed.length).toBe(input.length);
  });

  it("applies bandpass and normalize filters", () => {
    const input = new Float32Array([0.1, 0.5, 0.9, -0.9, 0.2]);
    const filtered = applyBandpass(input, 24000, 150, 3500);
    expect(filtered.length).toBe(input.length);

    const normalized = applyNormalize(input, 0.9);
    expect(normalized.length).toBe(input.length);
    expect(Math.max(...Array.from(normalized).map(Math.abs))).toBeCloseTo(0.9, 3);
  });
});

describe("cleanTextForSpeech", () => {
  it("strips think blocks, code blocks, and markdown formatting", () => {
    const raw = `
<think>
Internal thought process here. Let's analyze the question.
</think>

Here is the answer to your question:
\`\`\`typescript
const x = 42;
console.log(x);
\`\`\`
Check out [this link](https://example.com) for **more information**!
<artifact identifier="counter" type="application/react" title="Counter">
function Counter() { return <div>1</div> }
</artifact>
- Point one
- Point two
`;

    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).not.toContain("<think>");
    expect(cleaned).not.toContain("Internal thought process");
    expect(cleaned).not.toContain("console.log");
    expect(cleaned).not.toContain("https://example.com");
    expect(cleaned).toContain("Here is the answer to your question:");
    expect(cleaned).toContain("Code block omitted.");
    expect(cleaned).toContain("Check out this link for more information!");
    expect(cleaned).toContain("Artifact code omitted.");
  });

  it("handles empty or whitespace strings", () => {
    expect(cleanTextForSpeech("")).toBe("");
    expect(cleanTextForSpeech("   \n\t  ")).toBe("");
  });
});

describe("splitTextIntoSpeechChunks", () => {
  it("splits multi-sentence text into small immediate chunks", () => {
    const text = "Cogito online. Distant transmission established. Systems operational across all parameters.";
    const chunks = splitTextIntoSpeechChunks(text, 50);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe("Cogito online. Distant transmission established.");
    expect(chunks[1]).toBe("Systems operational across all parameters.");
  });

  it("splits single long sentence by clause or length boundaries", () => {
    const text = "This is a comprehensive response that explains the architecture in great detail, covering each component thoroughly, and providing actionable insights for development.";
    const chunks = splitTextIntoSpeechChunks(text, 60);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(85);
    });
  });

  it("returns empty array for empty or whitespace text", () => {
    expect(splitTextIntoSpeechChunks("")).toEqual([]);
    expect(splitTextIntoSpeechChunks("   \n  ")).toEqual([]);
  });
});

