# ADR-0011: Dynamic Chat Titling and API Profile / Model Switching

## Status: Accepted

## Context

Two usability and architectural issues were identified in chat and model management:

1. **Static and Naive Chat Titles:**
   Previously, conversation titles in `AppShell.tsx` were simply truncated slices of the very first message sent by the user (`firstUserMessage.slice(0, 40) + "…"`). If a user typed "hi" or "can you help me with a python script", the title remained "hi" or "can you help me with a python script" indefinitely. Users also had no way to rename or delete conversations directly in the sidebar.

2. **Hardcoded Router Defaults & Opaque API Profile Selection:**
   Previously, documentation and example env configurations contained hardcoded references to a local proxy port (`20128` / 9router), causing confusion when users connected to standard local backends (e.g. LM Studio on port 1234, Ollama on 11434, or OpenAI-compatible endpoints). Furthermore, while multiple API profiles could be defined in `SettingsModal.tsx`, the `ModelSelector` dropdown in the main chat composer did not show which backend/profile was currently connected, could not switch between configured profiles directly, and did not synchronize dynamically when profiles were switched.

## Decision

1. **Asynchronous AI Chat Titling with Robust Client Heuristics:**
   - Introduced `src/lib/title-utils.ts` (client-safe) for formatting, markdown stripping, XML/thinking block removal, and intelligent fallback extraction that strips conversational boilerplate ("can you please help me...", "how do I...", etc.).
   - Introduced `src/lib/chat-titling.ts` (server-side) and `POST /api/chat/title` route to generate concise 3–6 word descriptive conversation titles using the configured LLM backend.
   - In `AppShell.tsx`, the initial message gets an immediate smart fallback title, and upon completion of the first turn, the client triggers `/api/chat/title` in the background and updates the conversation title seamlessly.
   - In `Sidebar.tsx`, added inline conversation renaming (pencil icon with keyboard shortcuts) and one-click chat deletion (trash icon).

2. **Dynamic API Profile Visibility and Seamless Switching:**
   - Removed all hardcoded 9router/custom router ports (20128) and credentials from documentation, examples, and defaults. Standardized defaults to `http://localhost:1234/v1` (LM Studio) and `http://localhost:11434/v1` (Ollama).
   - Enhanced `GET /api/models` to return active profile metadata, connection status, and the list of configured profiles alongside the models list.
   - Added `POST /api/models` to allow activating an API profile dynamically, reloading models and auto-selecting the profile's default model in one step.
   - Enhanced `ModelSelector.tsx` with:
      - Clean, minimalist trigger button matching Claude styling (no online/offline indicator clutter).
      - In-place view transitions (`main` ↔ `effort` ↔ `profiles`) anchored within the dropdown boundary (`right-0`) to eliminate right-side screen overflow.
      - Integrated API profile switcher allowing instant 1-click backend profile switching.
      - Global synchronization via `cogito:profile-changed` custom event between `SettingsModal`, `ModelSelector`, and `AppShell`.

## Consequences

- Conversation history displays meaningful, readable AI-generated titles instead of raw prompt fragments, with full support for user renaming and deletion.
- Users can see exactly which backend profile is connected and switch between different providers/profiles on the fly.
- Zero hardcoded router dependencies or leaked ports in the repository.

## Implementation status

- Implemented on 2026-08-26.
- Created `src/lib/title-utils.ts` and `src/app/api/chat/title/route.ts`.
- Updated `src/lib/api-profiles.ts`, `src/app/api/models/route.ts`, `src/components/ModelSelector.tsx`, `src/components/Sidebar.tsx`, `src/components/Composer.tsx`, and `src/components/AppShell.tsx`.
- Cleaned `.env.local.example`, `README.md`, and local config defaults.
- All 120 Vitest unit tests pass and Next.js production build (`npm run build`) succeeded with 20/20 routes.
