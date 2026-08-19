# CLAUDE.md — Cogito project instructions

This file orients any Claude Code session (or human) working in this repo.
Read this first, then `docs/PLAN.md`, then the ADRs in `docs/adr/` before
writing code.

## What Cogito is
An offline AI chat app that visually replicates the Claude.ai chat
interface but talks only to local LLM backends (Ollama or LM Studio).
No Anthropic API calls. No Anthropic branding. See `docs/adr/0004-*.md`
for the exact branding boundary — short version: match the *interaction
design*, never reproduce the logo/wordmark/marketing copy.

**Projects + RAG (ADR-0005):** optional project document libraries on
disk under `data/` (gitignored). Embeddings may call the same
OpenAI-compatible `BACKEND_BASE_URL` (`POST /embeddings`) — documents
stay local; this is the only intentional non-chat outbound for RAG.

## Current status
**Active development.** The planning phase is done — this file,
`docs/PLAN.md`, and the ADRs in `docs/adr/` are confirmed. A Claude Code
session picking up this repo should do two jobs, not just one:
1. **Build the project** — scaffold and implement code following the
   phases in `docs/PLAN.md` and the decisions in `docs/adr/`.
2. **Manage the documents** — keep `docs/PLAN.md` (checking off phases as
   they land), the ADRs (their `Implementation status` / `Next steps`
   sections), and `docs/DESIGN_SYSTEM.md` in sync with what's actually in
   the repo. Docs going stale the moment code starts moving is exactly
   what this section is here to prevent.

If you're picking this repo up and the actual code/docs state disagrees
with something in this file, trust the repo over this file — and update
this file to match rather than silently working around the mismatch.

## Git rules (do not violate)
- **Never run `git push`, or anything that publishes commits/branches to
  a remote, unless the user explicitly asks for it in that message.** A
  prior push approval does not carry forward to later changes — ask again
  each time.
- Local commits on the working branch are fine when they help checkpoint
  progress, but call out what you committed so the user isn't surprised.
- Never force-push, rewrite history, delete branches, or touch remotes
  (`git remote`, `git fetch --prune`, etc.) without explicit instruction.

## Required reading order
1. `docs/PLAN.md` — phased build plan, scope, open questions.
2. `docs/adr/0001-nextjs-app-router-proxy-architecture.md`
3. `docs/adr/0002-backend-adapter-pattern.md`
4. `docs/adr/0003-streaming-strategy.md`
5. `docs/adr/0004-visual-design-and-branding-boundary.md`
6. `docs/adr/0005-rag-projects-and-remote-embeddings.md`
7. `docs/DESIGN_SYSTEM.md` — color tokens, type scale, spacing, component
   notes.
8. `refrence/` — the actual screenshots everything above was derived from.
   Look at them again before touching any visual code; the docs are a
   summary, not a replacement.

## Tech stack (fixed, do not substitute without a new ADR)
- Next.js, App Router, latest stable
- TypeScript, strict mode on
- React
- Tailwind CSS
- Route Handlers (Node runtime, not Edge) as the only place that talks to
  Ollama/LM Studio — browser never calls localhost:11434 or
  localhost:1234 directly (ADR-0001)
- `react-markdown` + `remark-gfm` for markdown
- Shiki or `rehype-pretty-code` for code syntax highlighting
- Streaming via `fetch` + `ReadableStream`, chunked plain text — no SSE,
  no WebSockets (ADR-0003)
- RAG (ADR-0005): `better-sqlite3` + FTS5 per project under `data/`,
  `pdf-parse` for text-layer PDFs, embeddings via OpenAI-compatible
  `POST /embeddings` on `BACKEND_BASE_URL` (`EMBEDDING_MODEL` env).
  Code under `src/lib/rag/` and `src/app/api/projects/`.

## Backend contract (do not violate)
- Everything goes through the `ChatBackend` interface (`lib/types.ts`).
  Never call Ollama or LM Studio APIs directly from a component or hook —
  always through `lib/backend-config.ts` → adapter.
- Two adapters only for v1: `lib/ollama-client.ts`,
  `lib/lmstudio-client.ts`. Active backend selected via `.env.local`:
  ```
  BACKEND_TYPE=ollama        # or: lmstudio
  BACKEND_BASE_URL=http://localhost:11434     # or: http://localhost:1234/v1
  BACKEND_API_KEY=           # optional Bearer for proxies
  EMBEDDING_MODEL=text-embedding-3-small   # must exist on embeddings-capable backends
  ```
- Adding a third backend later = one new adapter file implementing
  `ChatBackend`. Never branch on backend type outside `lib/`.
- RAG retrieval/ingest is server-only (`src/lib/rag/*`); UI talks only to
  `/api/projects` and `/api/chat` (with optional `projectId`).

## Visual rules (do not violate)
- Product name is **"Cogito"**, never "Claude", anywhere in UI strings,
  metadata, page titles, or comments-facing-user copy.
- Do not import, recreate, or approximate the Anthropic sunburst logo.
  Cogito needs its own mark.
- Do not copy Anthropic marketing copy (tagline, plan names like
  "Free plan"/"Upgrade", login screen copy). Generic UI vocabulary
  ("New chat", "Copy", "Send", "Settings") is fine — that's not IP.
- Color tokens, type scale, and spacing live in `docs/DESIGN_SYSTEM.md` —
  implement as CSS variables in `app/globals.css`, don't hardcode hex
  values in components.
- Default to dark theme first (matches the reference screenshots
  directly) and treat light theme as the derived/secondary pass — see
  the theming note at the bottom of `docs/DESIGN_SYSTEM.md`.
- Message asymmetry is intentional: user turns get a bubble
  (`--surface-user-bubble`), assistant turns are bare text with no
  bubble. Don't "fix" this into a symmetric bubble-for-both layout.

## Folder structure
Follow the structure agreed in `docs/PLAN.md` §4 / the original proposal
(app/, components/, lib/, hooks/, store/). If a new top-level folder feels
necessary, note why in a new ADR rather than adding it silently.

## Workflow expectations
- Don't jump straight to code from a feature request — check whether it
  changes something an ADR already decided. If it does, that's a signal
  to write a new ADR (or amend one) rather than quietly diverging.
- Keep backend adapters and UI components decoupled at all times — this
  is the whole point of ADR-0002. A quick fix that has a component import
  `ollama-client.ts` directly is the wrong fix.
- No telemetry, analytics, or outbound network calls other than to the
  user's configured local backend. This is an offline-first tool by
  definition.

## Open questions to resolve with the user before/while building
See `docs/PLAN.md` §6 (default backend, chat history persistence, target
models for testing).
