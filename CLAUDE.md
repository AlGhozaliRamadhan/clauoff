# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CLAUDE.md — Cogito project instructions

This file orients any Claude Code session (or human) working in this repo.
If anything here disagrees with the actual code, **trust the repo over this
file** — and update this file to match rather than silently working around
the mismatch. This file was reconciled with the code on 2026-08-10.

## What Cogito is
A chat app that replicates the Claude.ai-style chat *interaction design*
but talks to user-configured LLM backends. There is no Anthropic API call
anywhere. The chat backend is a **generic OpenAI-compatible API** (LM
Studio, Ollama's `/v1`, Cloudflare-tunneled endpoints, etc.) — see
`.env.local.example` and the `OpenAiClient` adapter.

Two real capabilities on top of plain chat:
- **Projects + RAG (ADR-0005):** per-project document libraries on disk
  under `data/` (gitignored). Documents are chunked, embedded via the same
  backend's OpenAI-compatible `POST /embeddings`, and stored in a
  `better-sqlite3` DB (FTS5 + dense vectors) per project. Chat retrieves
  context from the bound project and cites sources.
- **Web search (ADR-0006, amended) + agentic tool registry (ADR-0007):**
  the **model decides** when a search is warranted — when uncertain, when
  facts may have changed (news, prices, versions, availability), or when
  asked for up-to-date info — and skips it for stable knowledge,
  creative/opinion work, or questions about the conversation itself. A
  global capability switch in `AppShell` (default **on**) decides whether
  the model is offered tools at all. Tools are declared declaratively in
  `src/lib/agent/tools.ts` (name, description, smart-usage policy,
  `execute()`); the chat route builds the model-visible `<tool>` manifest
  via `buildToolsPrompt(TOOLS)`, and `src/lib/agent/tool-loop.ts` dispatches
  `<action name="X">` by registry lookup. Adding a tool = one new registry
  entry — no edits to the loop or route. The first (and only) tool is
  `search_web` (keyless DuckDuckGo via `src/lib/web-search.ts`). A tool's
  `execute()` returns `modelContext` (fed back as `<action_result>`) plus an
  optional `status` (structured items streamed as a `<tool_results>` tag and
  rendered as a collapsible "Search results" list under the message).
  Tool-status narration (`<step>` blocks) is folded into the thought
  process, never visible text. `buildToolsPrompt` also instructs the model
  to always think inside `<think>…</think>`, never narrate tool
  failures/mechanics, never prefix answers with "Final answer:", and never
  repeat words. Chat requests carry `frequency_penalty: 0.6` to suppress
  repetition loops. `MessageAssistant` strips a leading "Final answer:"
  label client-side (formatting artifact only).

## Current status
**Working build, active development.** The planning-era docs referenced by
older versions of this file (`docs/PLAN.md`, `docs/DESIGN_SYSTEM.md`,
ADRs 0001–0005, `refrence/` screenshots) **do not exist in the repo** — only
`docs/adr/0006-web-search-capability.md` and
`docs/adr/0007-agentic-tool-registry.md` exist. Do not re-create or
"restore" the missing ones from memory. Design tokens are implemented
directly in `src/app/globals.css` (dark-first CSS variables + a light theme
block). No git commits exist yet; the tree is uncommitted.

## Commands
- `npm run dev` — start the Next.js dev server on http://localhost:3000
- `npm run build` — production build (`next build`)
- `npm run lint` — ESLint (`eslint-config-next` core-web-vitals + TS)
- `npm test` — run all Vitest tests (`vitest run`)
- `npm run test:watch` — watch mode
- Single test file / filter: `npx vitest run src/lib/rag/__tests__/retrieve.test.ts`
  or `npx vitest run src/lib/agent/__tests__/tools.test.ts`
  (vitest accepts a path or `-t <name>` filter; all tests live under
  `src/**/__tests__/**/*.test.ts`, node environment)

## Tech stack (fixed)
- Next.js 16 (App Router), React 19, TypeScript strict
- Tailwind CSS v4 (`@import "tailwindcss"` + `@theme inline` bridging the
  design-token CSS variables in `globals.css`)
- Route Handlers only — Node runtime (`export const runtime = "nodejs"`),
  never Edge. The browser never calls the backend directly (see
  `backend-config.ts`).
- `react-markdown` + `remark-gfm` for markdown; `shiki` for code
  highlighting (`CodeBlock.tsx`)
- Streaming is plain-chunked text over `fetch` + `ReadableStream` — the
  SSE parser (`src/lib/stream-parser.ts`) consumes the upstream OpenAI-style
  stream and emits `choices[0].delta.content` strings. No WebSockets.
- `better-sqlite3` + FTS5 (WAL mode) and `pdf-parse` for RAG
- `@/*` path alias maps to `src/*`

## Backend architecture (do not violate)
- **One adapter, not two:** `ChatBackend` (`src/lib/types.ts`) has exactly
  one implementation, `OpenAiClient` (`src/lib/openai-client.ts`), which
  hits the OpenAI-compatible `/chat/completions` and `/models` endpoints.
  It sends `HTTP-Referer`, `X-Title`, and a browser `User-Agent` header
  (required by some proxies), plus optional Bearer auth.
- **Config is runtime-editable, not build-time:** API profiles
  (`ApiProfile[]` + `activeId`) are stored in `data/cogito-config.json`
  (gitignored) and served/updated via `GET/POST /api/config`.
  `src/lib/backend-config.ts` → `getBackend()` builds a fresh client from
  the active profile every call (no caching, so config changes apply on the
  next request). `.env.local` values (`BACKEND_BASE_URL`, `BACKEND_API_KEY`,
  `DEFAULT_MODEL`) are only *fallbacks* when no profile exists.
- The `BACKEND_TYPE=ollama|lmstudio` switch and `ollama-client.ts` /
  `lmstudio-client.ts` described in old docs **no longer exist**. Do not
  reintroduce a backend-type enum or branch on backend type outside `lib/`.
- **Never import a backend client from a component or hook** — always go
  through `src/lib/backend-config.ts`. A "quick fix" that calls the API
  directly from the UI is the wrong fix.
- RAG and web search are **server-only** (`src/lib/rag/*`,
  `src/lib/web-search.ts`). The UI talks only to `/api/chat` (with optional
  `projectId`, `webSearch`, `effort`, `thinking`), `/api/models`,
  `/api/config`, `/api/search`, and `/api/projects*`.

## Backend quirks (`cogito.py` — observed 2026-08-10)

The default llama.cpp wrapper used by this project (`cogito.py`) is *not*
a vanilla OpenAI-compatible endpoint. When debugging "the model is doing
something weird," check this list before suspecting our code:

- **System-prompt override.** cogito.py injects its own canonical system
  prompt (with a strict persona: "be analytical, maintain epistemic rigor,
  …") and forcibly *overrides* the first system message we send. Our
  `thought-prompts.ts` and `buildToolsPrompt` rules therefore reach the
  model as **user-side context**, not as system authority. Expect small
  models to follow their persona over ours when they conflict.
- **Forced `<think>\n` suffix.** cogito.py appends `<think>\n` to the end
  of the input. The model has no choice but to start generating inside a
  thought. This makes "bare thought" failures structurally more likely.
- **Stop tokens matter.** A custom stop list can truncate the stream the
  moment the model emits a tag we use (e.g. `</think>`). Symptom: the
  model *wanted* to write a visible reply but the stream was cut off.
  If you see "the model only ever produces thought, never reply,"
  inspect the server's stop list first.
- **`frequency_penalty` is silently dropped.** The cogito.py Pydantic
  schema doesn't define it, so any `frequency_penalty` we send is
  ignored. The client sends `repeat_penalty: 1.1` as well so llama.cpp
  gets anti-repetition coverage; keep both. Default `repeat_penalty` if
  unspecified was `1.0` (no penalty) — without an explicit value from
  us, the model can fall into a repetition loop and emit garbage like
  `.UseText .UseText …`. Sending `repeat_penalty: 1.1` from the client
  is what prevents this.
- **Server-side defaults if the client omits them:** `temperature: 0.7`,
  `top_p: 0.95`, `top_k: 40`, `repeat_penalty: 1.0` (now bumped to `1.1`
  server-side as of the 2026-08-10 hotfix).
- **`<confidence>` persona artifact.** cogito.py's persona prompt
  encourages the model to wrap its reasoning in `<confidence>…</confidence>`
  blocks. These are internal narration, *not* the answer. The bare-thought
  guard (`src/lib/agent/bare-thought-guard.ts`) treats a `<confidence>`
  block with no sentence-final answer as a bare thought and triggers a
  continuation turn.

## Chat request flow
`src/app/api/chat/route.ts` is the orchestrator, in this order:
1. Resolve model: request body → `DEFAULT_MODEL`/active profile → fallback
   to first model from `listModels()`.
2. If `projectId` set: retrieve top-8 chunks (hybrid dense+BM25 with
   Reciprocal Rank Fusion in `src/lib/rag/retrieve.ts`), build a RAG system
   message + inline citations, inject via `src/lib/rag/context.ts`. Source
   citations are returned in the **`Cogito-Sources` response header**
   (URL-encoded JSON) and rendered as chips under the message.
   Retrieval failure soft-warns instead of blocking the chat.
3. If `webSearch` enabled: append the tool manifest
   (`buildToolsPrompt(TOOLS)` from `src/lib/agent/tools.ts`), then run
   `runAgenticToolLoop` (`src/lib/agent/tool-loop.ts`, max 3 turns). The
   loop streams pre-action text to the client, dispatches any
   `<action name="X">` through the tool registry, pushes the action result
   back into the message history, and continues until the model stops
   emitting `<action>` tags. Unknown actions are flushed as plain text.
4. If `thinking` enabled: append an effort-scaled `<think>...</think>`
   prompt (`src/lib/thought-prompts.ts`) to the **last user message** —
   deliberately not a system message, to avoid clobbering any persona the
   backend model has.
5. Standard path: `getBackend().streamChat({ stream: true, max_tokens: 8192 })`.
Errors are JSON `{ error }` with 502 (backend) / 400 / 404. Response is
`text/plain; charset=utf-8` with `Cache-Control: no-cache`.

## Frontend architecture
- **All client state lives in `AppShell.tsx`** (the single page component;
  both `/` and `/c/[id]` render it). Conversations, active conversation,
  projects, active project, model, streaming + abort controllers, web-search
  toggle, and the settings modal all flow from here into dumb presentational
  components (`Sidebar`, `TopBar`, `ChatThread`, `Composer`, `EmptyState`,
  `ProjectsView`, `SettingsModal`).
- **Persistence is client-side only:** conversations and the active
  conversation/project live in `localStorage` via `conversation-store.ts`
  (`cogito.conversations.v1`) and `project-store.ts`. URLs `/c/<id>` sync
  via `history.replaceState`. There is **no server-side chat history** — a
  server restart keeps chats because the browser holds them.
- `ChatThread` renders user turns as a bubble (`MessageBubbleUser`) and
  assistant turns as bare text (`MessageAssistant`). This asymmetry is
  intentional — do not "fix" it into symmetric bubbles.
- **Artifacts:** assistant code blocks (`CodeBlock.tsx`) can set
  `setActiveArtifact({ language, content, title })` via the
  `ArtifactContext` (`src/contexts/ArtifactContext.tsx`); `AppShell` then
  splits the layout 50/50 and renders `ArtifactViewer` (code view or HTML/SVG
  preview).
- **Composer extras:** voice dictation (Web Speech API) and read-aloud
  (speechSynthesis) are implemented directly in `Composer.tsx`.

## RAG data layout (server-side)
Under `DATA_DIR` (default `<cwd>/data`, gitignored):
```
data/
  cogito-config.json          # API profiles (also served via /api/config)
  projects/
    registry.json             # project metadata list
    <projectId>/
      index.db                # better-sqlite3: documents, chunks, chunks_fts
      files/<docId>__<name>   # uploaded raw files
```
- Ingest (`src/lib/rag/ingest.ts`): extract text (`src/lib/rag/extract.ts` —
  PDFs text-layer only, no OCR; text/code by extension allowlist), chunk
  (`chunk.ts`, ~2000 chars, ~10% overlap), embed in batches of 16, store
  vectors as `Float32Array` blobs + FTS rows in one transaction.
- Retrieval (`retrieve.ts`): dense (cosine over all stored vectors, falls
  back to FTS-only if embeddings fail) + BM25/FTS5 (`porter unicode61`),
  fused with `rrfFuse`. `sanitizeFtsQuery` strips punctuation and joins
  tokens with OR.
- A project pins its `embeddingModel`/`embeddingDims`; ingest rejects files
  if the embedding dimension changes mid-project (reindex required).
- `better-sqlite3` DB handles are cached in a module-level `Map`; closed on
  project delete. Server-only (`@/lib/rag/*`).

## Visual rules (do not violate)
- Product name is **"Cogito"**, never "Claude", in any user-facing string,
  metadata, or page title.
- Do not use, recreate, or approximate the Anthropic sunburst logo. Cogito
  uses its own mark (`CogitoIcon-transparant.png`).
- All colors, type scale, and spacing come from CSS variables defined in
  `src/app/globals.css` (dark-first `:root`, light overrides under
  `[data-theme="light"]`, exposed to Tailwind via `@theme inline`). Do not
  hardcode hex values in components. Typography: Inter (UI/body), JetBrains
  Mono (mono), Lora (display) loaded via `next/font/google` in `layout.tsx`.

## Workflow expectations
- Chat history and API-profile config are **user data in `data/` and
  `localStorage`** — never commit them; `.gitignore` covers `/data`.
- Don't jump straight to code from a feature request — check whether it
  changes an existing decision (ADRs 0006/0007). Notable drift-to-fix: the
  ADR-0006 UI toggle isn't rendered — `Composer.tsx` declares
  `webSearchEnabled`/`onWebSearchToggle` props but no control is wired, and
  the AppShell flag (`useState(true)`) isn't persisted; old docs claiming a
  backend-type switch.
- If a change would add a second backend adapter, make it one new file
  implementing `ChatBackend` — never branch on backend identity in the UI.
- No telemetry or outbound calls other than to the user's configured
  backend, the RAG embeddings endpoint on that same backend, and (when the
  toggle is on) DuckDuckGo.
