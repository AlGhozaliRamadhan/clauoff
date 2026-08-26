/**
 * src/lib/audio/voice-fx.ts
 * TypeScript implementation of Cogito's "Distant transmission" audio DSP signal chain.
 *
 * Implements the 9-stage signal degradation and coloration pipeline:
 * 1. Wow & Flutter (irregular pitch wobble and read-head warp)
 * 2. Bandpass filter (bandwidth restriction 150 - 3500 Hz)
 * 3. Metallic resonance (comb filter delay line)
 * 4. Harmonic saturation (soft tanh drive)
 * 5. Drifting ring modulation (subtle unstable carrier)
 * 6. Broadcast compression (dynamic flattening and makeup)
 * 7. Envelope-following static bed (breathing interference noise)
 * 8. Dropouts & line clicks (intermittent signal degradation)
 * 9. Peak normalization
 */

// Simple seeded pseudo-random number generator for reproducible DSP artifacts
class SeededRng {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed;
  }

  next(): number {
    // Linear congruential generator (LCG)
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }

  normal(): number {
    // Box-Muller transform for normal distribution
    const u1 = Math.max(1e-15, this.next());
    const u2 = this.next();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  uniform(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  integer(min: number, max: number): number {
    return Math.floor(this.uniform(min, max));
  }
}

/**
 * 1. Wow & Flutter: Variable-rate resampling with slow, irregular wobble and random walk drift
 */
export function applyWowFlutter(
  signal: Float32Array,
  rate: number,
  depth: number = 0.005,
  speedHz: number = 0.5,
  seed: number = 7,
): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);
  const rng = new SeededRng(seed);

  // Compute drift random walk
  const drift = new Float32Array(n);
  let currentDrift = 0;
  let maxAbsDrift = 1e-9;
  for (let i = 0; i < n; i++) {
    currentDrift += rng.normal();
    drift[i] = currentDrift;
    if (Math.abs(currentDrift) > maxAbsDrift) {
      maxAbsDrift = Math.abs(currentDrift);
    }
  }

  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const wobble = Math.sin(2 * Math.PI * speedHz * t);
    const normDrift = drift[i] / maxAbsDrift;
    const warp = depth * (0.7 * wobble + 0.3 * normDrift);

    const readPos = Math.max(0, Math.min(n - 1, i + warp * rate));
    const idx0 = Math.floor(readPos);
    const idx1 = Math.min(n - 1, idx0 + 1);
    const frac = readPos - idx0;

    out[i] = (1 - frac) * signal[idx0] + frac * signal[idx1];
  }

  return out;
}

/**
 * 2. Bandpass Filter using Cascaded Second-Order Sections (Biquad filters)
 */
export function applyBandpass(
  signal: Float32Array,
  rate: number,
  lowCut: number = 150,
  highCut: number = 3500,
): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);

  // Highpass filter (150 Hz)
  const hpW0 = (2 * Math.PI * lowCut) / rate;
  const hpQ = 0.707;
  const hpAlpha = Math.sin(hpW0) / (2 * hpQ);
  const hpCos = Math.cos(hpW0);
  const hpB0 = (1 + hpCos) / 2;
  const hpB1 = -(1 + hpCos);
  const hpB2 = (1 + hpCos) / 2;
  const hpA0 = 1 + hpAlpha;
  const hpA1 = -2 * hpCos;
  const hpA2 = 1 - hpAlpha;

  // Lowpass filter (3500 Hz)
  const lpW0 = (2 * Math.PI * highCut) / rate;
  const lpQ = 0.707;
  const lpAlpha = Math.sin(lpW0) / (2 * lpQ);
  const lpCos = Math.cos(lpW0);
  const lpB0 = (1 - lpCos) / 2;
  const lpB1 = 1 - lpCos;
  const lpB2 = (1 - lpCos) / 2;
  const lpA0 = 1 + lpAlpha;
  const lpA1 = -2 * lpCos;
  const lpA2 = 1 - lpAlpha;

  // State variables
  let hpX1 = 0, hpX2 = 0, hpY1 = 0, hpY2 = 0;
  let lpX1 = 0, lpX2 = 0, lpY1 = 0, lpY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = signal[i];

    // Highpass stage
    const hpY = (hpB0 * x + hpB1 * hpX1 + hpB2 * hpX2 - hpA1 * hpY1 - hpA2 * hpY2) / hpA0;
    hpX2 = hpX1;
    hpX1 = x;
    hpY2 = hpY1;
    hpY1 = hpY;

    // Lowpass stage
    const lpY = (lpB0 * hpY + lpB1 * lpX1 + lpB2 * lpX2 - lpA1 * lpY1 - lpA2 * lpY2) / lpA0;
    lpX2 = lpX1;
    lpX1 = hpY;
    lpY2 = lpY1;
    lpY1 = lpY;

    out[i] = lpY;
  }

  return out;
}

/**
 * 3. Metallic Resonance (Feedback comb filter)
 */
export function applyMetallicResonance(
  signal: Float32Array,
  rate: number,
  delayMs: number = 9.0,
  feedback: number = 0.5,
  mix: number = 0.3,
): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);
  const delaySamples = Math.max(1, Math.floor((rate * delayMs) / 1000.0));
  const delayBuffer = new Float32Array(delaySamples);
  let bufIndex = 0;

  for (let i = 0; i < n; i++) {
    const delayed = delayBuffer[bufIndex];
    const wet = signal[i] + feedback * delayed;
    delayBuffer[bufIndex] = wet;
    bufIndex = (bufIndex + 1) % delaySamples;

    out[i] = (1 - mix) * signal[i] + mix * wet;
  }

  return out;
}

/**
 * 4. Harmonic Saturation (Soft tanh drive for gritty edge)
 */
export function applySaturation(
  signal: Float32Array,
  drive: number = 6.0,
  mix: number = 0.8,
): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);
  const normTanh = Math.tanh(drive);

  for (let i = 0; i < n; i++) {
    const driven = Math.tanh(signal[i] * drive) / normTanh;
    out[i] = (1 - mix) * signal[i] + mix * driven;
  }

  return out;
}

/**
 * 5. Drifting Ring Modulation (Low mix of amplitude modulation with drifting carrier)
 */
export function applyRingMod(
  signal: Float32Array,
  rate: number,
  baseFreq: number = 45,
  wobbleHz: number = 0.15,
  wobbleDepth: number = 6,
  mix: number = 0.045,
): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);
  let phase = 0;

  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const freqT = baseFreq + wobbleDepth * Math.sin(2 * Math.PI * wobbleHz * t);
    phase += (2 * Math.PI * freqT) / rate;
    const carrier = Math.sin(phase);
    const modulated = signal[i] * carrier;

    out[i] = (1 - mix) * signal[i] + mix * modulated;
  }

  return out;
}

/**
 * 6. Broadcast Dynamics Compression
 */
export function applyCompression(
  signal: Float32Array,
  threshold: number = 0.15,
  ratio: number = 8.0,
  makeup: number = 2.0,
): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const sample = signal[i];
    const sign = sample < 0 ? -1 : 1;
    const mag = Math.abs(sample);

    let compressedMag = mag;
    if (mag > threshold) {
      compressedMag = threshold + (mag - threshold) / ratio;
    }

    out[i] = sign * compressedMag * makeup;
  }

  return out;
}

/**
 * 7. Static Bed (Interference noise that breathes with speech amplitude envelope)
 */
export function applyStaticBed(
  signal: Float32Array,
  rate: number,
  level: number = 0.04,
  seed: number = 13,
): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);
  const rng = new SeededRng(seed);

  // Compute envelope via rolling abs-mean
  const windowSize = Math.max(1, Math.floor(rate / 50));
  const envelope = new Float32Array(n);
  let rollingSum = 0;

  for (let i = 0; i < n; i++) {
    rollingSum += Math.abs(signal[i]);
    if (i >= windowSize) {
      rollingSum -= Math.abs(signal[i - windowSize]);
    }
    envelope[i] = rollingSum / windowSize;
  }

  let maxEnv = 1e-9;
  for (let i = 0; i < n; i++) {
    if (envelope[i] > maxEnv) maxEnv = envelope[i];
  }

  const noiseFloor = 0.3; // Static never completely disappears in pauses
  for (let i = 0; i < n; i++) {
    const normEnv = envelope[i] / maxEnv;
    const noise = rng.normal();
    const shapedNoise = noise * level * (noiseFloor + (1 - noiseFloor) * normEnv);
    out[i] = signal[i] + shapedNoise;
  }

  return out;
}

/**
 * 8. Dropouts (Intermittent transmission packet loss and subtle line clicks)
 */
export function applyDropouts(
  signal: Float32Array,
  rate: number,
  numEvents: number = 14,
  seed: number = 21,
): Float32Array {
  const n = signal.length;
  const out = new Float32Array(signal);
  const rng = new SeededRng(seed);

  for (let e = 0; e < numEvents; e++) {
    const start = rng.integer(0, Math.max(1, n - Math.floor(rate / 4)));
    const dur = rng.integer(Math.floor(rate * 0.03), Math.floor(rate * 0.18));
    const end = Math.min(n, start + dur);
    const depth = rng.uniform(0.15, 0.75);

    for (let i = start; i < end; i++) {
      out[i] *= depth;
    }

    if (rng.next() < 0.4) {
      const clickPos = Math.min(n - 1, end);
      const clickLen = Math.max(2, Math.floor(rate / 4000));
      for (let c = clickPos; c < Math.min(n, clickPos + clickLen); c++) {
        out[c] += rng.uniform(-0.6, 0.6);
      }
    }
  }

  return out;
}

/**
 * 9. Peak Normalization
 */
export function applyNormalize(signal: Float32Array, peak: number = 0.58): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);
  let maxAbs = 1e-9;

  for (let i = 0; i < n; i++) {
    const absVal = Math.abs(signal[i]);
    if (absVal > maxAbs) maxAbs = absVal;
  }

  const scale = peak / maxAbs;
  for (let i = 0; i < n; i++) {
    out[i] = signal[i] * scale;
  }

  return out;
}

/**
 * Low-Shelf filter to boost deep voice resonance (< 220 Hz) for proximity broadcast warmth
 */
export function applyLowShelf(
  signal: Float32Array,
  rate: number,
  freq: number = 190,
  gainDb: number = 5.0,
): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * freq) / rate;
  const alpha = (Math.sin(w0) / 2) * Math.SQRT2;
  const cosW0 = Math.cos(w0);
  const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;

  const b0 = A * (A + 1 - (A - 1) * cosW0 + twoSqrtAAlpha);
  const b1 = 2 * A * (A - 1 - (A + 1) * cosW0);
  const b2 = A * (A + 1 - (A - 1) * cosW0 - twoSqrtAAlpha);
  const a0 = A + 1 + (A - 1) * cosW0 + twoSqrtAAlpha;
  const a1 = -2 * (A - 1 + (A + 1) * cosW0);
  const a2 = A + 1 + (A - 1) * cosW0 - twoSqrtAAlpha;

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    const x = signal[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

/**
 * Complete Cogito Voice FX Pipeline:
 * Transforms clean TTS into the cold, deep, textured, distant radio transmission signature.
 */
export function processCogitoVoice(signal: Float32Array, rate: number = 24000): Float32Array {
  let x = applyLowShelf(signal, rate, 200, 5.5);              // Deep chest resonance & broadcast proximity warmth
  x = applyWowFlutter(x, rate, 0.005, 0.5);                   // Unstable tape/radio pitch wobble
  x = applyBandpass(x, rate, 75, 3600);                       // Retain deep 75Hz+ chest fundamentals + 3.6kHz radio ceiling
  x = applyMetallicResonance(x, rate, 9.0, 0.5, 0.3);         // Resonant metallic comb filter
  x = applySaturation(x, 5.5, 0.8);                           // Rich harmonic saturation and distortion
  x = applyRingMod(x, rate, 42, 0.15, 6, 0.045);              // Drifting carrier ring modulation
  x = applyCompression(x, 0.14, 8.0, 2.0);                    // Heavy detached broadcast compression
  x = applyStaticBed(x, rate, 0.038);                         // Breathing radio static interference bed
  x = applyDropouts(x, rate, 12);                             // Authentic vintage signal dropouts & clicks
  x = applyNormalize(x, 0.78);                                // Normalized peak
  return x;
}

// --------------------------------------------------------------------------
// Pure TypeScript WAV Encoders and Decoders
// --------------------------------------------------------------------------

/**
 * Encodes Float32Array audio samples into 16-bit PCM WAV format.
 */
export function encodeWav(samples: Float32Array, sampleRate: number = 24000): Uint8Array {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const bufferSize = 44 + dataSize;

  const buffer = new Uint8Array(bufferSize);
  const view = new DataView(buffer.buffer);

  // RIFF identifier
  buffer.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  buffer.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

  // fmt subchunk
  buffer.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample

  // data subchunk
  buffer.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  view.setUint32(40, dataSize, true);

  // Write PCM 16-bit samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1.0, Math.min(1.0, samples[i]));
    const intVal = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, intVal, true);
    offset += 2;
  }

  return buffer;
}

/**
 * Decodes a 16-bit PCM WAV into Float32Array samples and sample rate.
 */
export function decodeWav(buffer: Uint8Array | ArrayBuffer): { samples: Float32Array; sampleRate: number } {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Read header
  const sampleRate = view.getUint32(24, true);
  const numChannels = view.getUint16(22, true);
  const bitsPerSample = view.getUint16(34, true);

  // Find "data" chunk
  let dataOffset = 12;
  let dataSize = 0;
  while (dataOffset < bytes.byteLength - 8) {
    const tag = String.fromCharCode(
      bytes[dataOffset],
      bytes[dataOffset + 1],
      bytes[dataOffset + 2],
      bytes[dataOffset + 3],
    );
    const chunkSize = view.getUint32(dataOffset + 4, true);
    if (tag === "data") {
      dataOffset += 8;
      dataSize = chunkSize;
      break;
    }
    dataOffset += 8 + chunkSize;
  }

  if (dataSize === 0) {
    dataOffset = 44;
    dataSize = bytes.byteLength - 44;
  }

  const numSamples = Math.floor(dataSize / (bitsPerSample / 8) / numChannels);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const byteIdx = dataOffset + i * (bitsPerSample / 8) * numChannels;
    if (byteIdx + 2 > bytes.byteLength) break;
    const rawVal = view.getInt16(byteIdx, true);
    samples[i] = rawVal / (rawVal < 0 ? 0x8000 : 0x7fff);
  }

  return { samples, sampleRate };
}
