# ADR-0016: Local Hands-Free Voice Conversations

## Status: Accepted

## Context

Cogito already had two separate voice conveniences: browser
`SpeechRecognition` in `Composer.tsx` for one-shot dictation and local/browser
speech synthesis for reading assistant messages. That did not create a real
conversation:

- browser speech recognition is not consistently available and may send audio
  to a browser vendor rather than processing it locally;
- the composer owns the microphone, but the empty-state composer unmounts when
  the first turn creates a conversation;
- a fixed 1.2-second text timer sends one turn and then releases the microphone;
- nothing coordinates listening, transcription, model generation, speech
  playback, automatic re-listening, or interruption;
- `/api/transcribe` only probed configured or official remote endpoints, so a
  text-only LLM backend could not provide voice input;
- the Kokoro module began remote model loading during module import, before the
  user asked to use neural voice.

The product requirement is a Jarvis-style session: the user starts voice mode
once, speaks naturally, receives a spoken streamed response, can interrupt it,
and continues without pressing send for every turn. It must work with the same
OpenAI-compatible text backends as regular Cogito chat and must not require a
metered speech provider.

## Decision

1. **Voice remains an adapter around text chat.** Speech is transcribed before
   the existing `sendMessageText` path and streamed assistant text is synthesized
   after `/api/chat`. The LLM backend contract and `OpenAiClient` remain unchanged.

2. **The voice session is persistent and AppShell-owned.**
   `useVoiceSession` survives composer replacement and models the states `idle`,
   `preparing`, `listening`, `hearing`, `transcribing`, `thinking`, `speaking`,
   and `error`. `Composer` only presents its status and controls.

3. **Speech boundaries are detected locally in the browser.**
   `@ricky0123/vad-web` runs Silero VAD through ONNX Runtime Web against one
   echo-cancelled microphone stream. It emits complete 16 kHz Float32 speech
   segments. Generated WASM, worklet, and ONNX assets are copied from the pinned
   npm dependency into an ignored `public/vendor/vad/` directory before dev and
   production builds.

4. **Transcription is local by default.** `/api/transcribe` sends raw speech
   segments to an embedded, singleton Transformers.js Whisper pipeline in the
   Node runtime. The multilingual quantized model is warmed when the user starts
   voice mode and cached under `data/models/`. The old active-backend transcription
   proxy remains available only when explicitly requested; there is no silent
   official-API fallback.

5. **Speech output remains local-first.** Existing browser synthesis and Kokoro
   TTS continue consuming streamed, cleaned response phrases. Starting voice mode
   enables automatic speech playback. When real user speech is detected during
   generation or playback, Cogito aborts the current stream and audio queue before
   transcribing the interruption.

6. **History stores text, not microphone recordings.** The final transcript enters
   the normal conversation DAG as a user message. Assistant messages, sources,
   projects, titles, RAG, skills, and tools use the same paths as typed turns. Raw
   audio is held only long enough to transcribe it and is not persisted.

7. **Model network access is explicit and cacheable.** Starting local voice mode
   is the user action that authorizes a one-time model fetch from Hugging Face when
   files are not already cached. Model loading no longer starts at module import.
   No per-turn speech API or WebSocket is introduced.

## Consequences

- Voice mode works with every text LLM backend Cogito already supports; speech
  capability is no longer determined by that backend.
- After the one-time model preparation, STT, VAD, and neural TTS can run without
  per-call vendor quotas. Actual latency and concurrency remain bounded by the
  Cogito host's CPU/GPU and memory.
- The first local transcription can take noticeably longer while model files are
  downloaded and initialized, so the UI exposes preparation and transcription
  states rather than appearing unresponsive.
- Keeping the microphone active enables natural follow-up turns and barge-in, but
  acoustic echo cancellation and a higher speaking-time VAD threshold are needed
  to reduce false interruptions from Cogito's own audio.
- Two new direct dependencies and generated browser runtime assets increase the
  installation footprint. Generated assets are never committed.

## Implementation status

Implemented on 2026-09-01:

- added the persistent `useVoiceSession` controller and presentation status model;
- replaced composer-owned Web Speech API dictation with local Silero VAD capture;
- added embedded multilingual Whisper transcription and explicit warmup/status;
- removed silent OpenAI transcription fallback and background Kokoro warmup;
- connected voice transcripts to the existing conversation/history path and added
  barge-in cancellation;
- added voice asset preparation scripts and focused unit coverage.
