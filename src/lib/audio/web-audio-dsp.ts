/**
 * src/lib/audio/web-audio-dsp.ts
 * Real-time Web Audio API DSP node graph for browser speech synthesis and audio playback.
 * Replicates the Cogito "Distant transmission" signature live in the browser.
 */

export interface WebAudioFxChain {
  context: AudioContext;
  inputNode: AudioNode;
  outputNode: AudioNode;
  noiseSourceNode?: AudioBufferSourceNode;
  disconnect: () => void;
}

/**
 * Creates a distortion curve for soft harmonic saturation (tanh)
 */
function makeDistortionCurve(drive: number = 6.0, samples: number = 44100): Float32Array {
  const curve = new Float32Array(samples);
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * drive) / norm;
  }
  return curve;
}

/**
 * Creates a static interference noise buffer
 */
function createStaticNoiseBuffer(ctx: AudioContext, durationSec: number = 3): AudioBuffer {
  const bufferSize = ctx.sampleRate * durationSec;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    // White / pink noise mixture
    data[i] = (Math.random() * 2 - 1) * 0.035;
  }
  return buffer;
}

/**
 * Builds a Web Audio DSP processing graph for Cogito transmission FX
 */
export function createWebAudioFxChain(ctx: AudioContext): WebAudioFxChain {
  // 1. Highpass filter (150 Hz)
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 180;
  highpass.Q.value = 0.707;

  // 2. Lowpass filter (3500 Hz)
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 3400;
  lowpass.Q.value = 0.707;

  // 3. Metallic resonance comb filter (9ms delay with feedback)
  const delayNode = ctx.createDelay(0.1);
  delayNode.delayTime.value = 0.009; // 9ms
  const feedbackGain = ctx.createGain();
  feedbackGain.gain.value = 0.45; // 45% feedback

  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.35;
  const dryGain = ctx.createGain();
  dryGain.gain.value = 0.65;

  const resonanceMix = ctx.createGain();

  // 4. Harmonic Saturation (WaveShaper)
  const waveShaper = ctx.createWaveShaper();
  waveShaper.curve = makeDistortionCurve(4.5) as Float32Array<ArrayBuffer>;
  waveShaper.oversample = "2x";

  // 5. Broadcast Dynamics Compressor
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  // 6. Master Output Gain (calibrated for comfortable listening volume)
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.6;

  // Wire graph: input -> highpass -> lowpass -> split into dry + delay comb -> mix -> waveshaper -> compressor -> master
  highpass.connect(lowpass);

  // Comb filter loop
  lowpass.connect(dryGain);
  lowpass.connect(delayNode);
  delayNode.connect(feedbackGain);
  feedbackGain.connect(delayNode); // feedback loop
  delayNode.connect(wetGain);

  dryGain.connect(resonanceMix);
  wetGain.connect(resonanceMix);

  resonanceMix.connect(waveShaper);
  waveShaper.connect(compressor);
  compressor.connect(masterGain);

  // 7. Optional subtle static noise bed
  let noiseSource: AudioBufferSourceNode | undefined;
  try {
    const noiseBuf = createStaticNoiseBuffer(ctx, 4);
    noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuf;
    noiseSource.loop = true;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.012;
    noiseSource.connect(noiseGain);
    noiseGain.connect(compressor);
    noiseSource.start();
  } catch {
    // Non-critical if noise source cannot start
  }

  const disconnect = () => {
    try {
      if (noiseSource) {
        noiseSource.stop();
        noiseSource.disconnect();
      }
      highpass.disconnect();
      lowpass.disconnect();
      delayNode.disconnect();
      feedbackGain.disconnect();
      dryGain.disconnect();
      wetGain.disconnect();
      resonanceMix.disconnect();
      waveShaper.disconnect();
      compressor.disconnect();
      masterGain.disconnect();
    } catch {
      // Ignore disconnect errors on cleanup
    }
  };

  return {
    context: ctx,
    inputNode: highpass,
    outputNode: masterGain,
    noiseSourceNode: noiseSource,
    disconnect,
  };
}
