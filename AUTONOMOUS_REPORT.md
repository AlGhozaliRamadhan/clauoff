# AUTONOMOUS REPORT

**Session:** 2026-08-19 · Autonomous engineering run (ROLE mission)
**Branch:** `main` · **Baseline:** `ef1a047` ("bilek")
**Result:** Working build. All work committed. Git tree clean. `npm run build` passes with zero new errors. Full test suite passes (56 tests, 8 files).

This report covers: (1) everything I changed — file → why → how to test; (2) the full codebase audit with severity ratings, including items I deliberately skipped; (3) decisions that need a human.

---

## 1. Changed — file → why → how to test

All changes are committed and the build + tests are green.

### 1a. `feat: agentic thinking panel for chain-of-thought (P0)` — `a229cce`

**Files:** `src/components/ThinkingPanel.tsx` (new), `src/components/MessageAssistant.tsx`, `src/components/__tests__/ThinkingPanel.test.ts` (new)

**Why.** The P0 mission: turn the raw  thinking…</think>
…</think>
… response
 blocks into a polished, live "agent execution log" that feels like a debugger/agent loop, without touching server-side reasoning or persistence.

- **New `ThinkingPanel.tsx`** renders the chain-of-thought as a log. Each step has a status glyph: `done ✓` (emerald check), `running` (pulsing accent dot), `failed ✗` (red X), `interrupted ⏸` (secondary bars), `info ℹ` (circle-i). Tool calls show as `label` + a shortened quoted query param; `<tool_results>` collapse into a `<details>` "Search results" list per tool. Thought bodies render as plain text and are truncated at 280 chars with a **Show more** toggle when not streaming.
- **Status derivation** (`buildThinkingLog`): a `Using search_web for "…"` step opens a tool entry; the following `<tool_results>` closes it as `done`. An "encountered an issue" step fails the open tool. Any tool still open when the stream ends is `running` while streaming, `interrupted` afterwards. Edge cases handled: empty/whitespace-only thinking (renders nothing), very long thinking (truncate + show more), failed steps, interrupted generation (with an explicit "Generation was stopped — the log may be incomplete" note), and generic narration `<step>`s as informational rows.
- **Streaming UX contract:** the panel `auto-expands while live` (driven by `isStreaming`, which is exactly "this is the message being produced") so the user watches the log build in real time; once the reply finishes it collapses to a subtle **"Thinking…"** (live) / **"Thought process · N steps · M issues"** (done) summary. Click to expand/collapse always available; the user's manual toggle is respected over the live default.
- **MessageAssistant** now groups consecutive non-text blocks into one `ThinkingPanel` per group (thought-block → narration → tool → results stay in one timeline) and renders text blocks as before. The block parser is **unchanged**, so the raw reasoning stays in `message.content` — localStorage persistence and reload re-render are untouched (P0 persistence requirement satisfied with zero server changes).
- **Visual rules respected:** all colors come from CSS variables in `globals.css` (`--accent-primary`, `--border-subtle`, `--text-*`), emerald/red are fixed-state semantic colors used for ✓/✗ only, no new CSS framework, fonts use `font-ui`/`font-mono` tokens.

**How to test:**
1. `npm run dev`, open http://localhost:3000.
2. Turn the web-search toggle **on**, ask a question that triggers a tool call (e.g. "search the web for the latest Apache release").
3. While the model is answering you should see the panel **auto-expand** with the tool line pulsing (`running`), then flip to `✓ done` with a collapsible "N results" entry as the search result streams back. After the reply completes the panel collapses to "Thought process · N steps".
4. Click the summary to expand; click a results row to expand/collapse the listing.
5. Ask a question that produces only thought (or stop generation mid-thought with the stop button) → check the `interrupted` glyph and the "Generation was stopped" footnote.
6. Reload the page with an old conversation open → the panel re-renders identically (raw reasoning is persisted).
7. `npm test` — the 8 new `ThinkingPanel.test.ts` cases cover: done/results ordering, failed-step, running-while-streaming, interrupted-after-stream, thoughts-as-thinking, results-after-tool, generic-info, empty-group.

### 1b. `fix: correct thinking-panel live signal + escape codeblock fallback` — `a3e06d4`

**Files:** `src/components/ThinkingPanel.tsx`, `src/components/CodeBlock.tsx`, `src/components/MessageAssistant.tsx`

**Why.** Two audit findings, fixed because they were clearly-safe and correctness-adjacent:

- **Live-signal bug (ThinkingPanel).** The panel originally auto-expanded on `isActive={groupIdx === groups.length - 1}`. That is wrong: in a normal streamed message the **last** group is the visible text answer, not the thought block, so the panel would never auto-expand while thinking — the core P0 behavior was broken. Replaced with `isStreaming` alone, which already implies "this message is being produced." Propped up with comments explaining the reasoning.
- **XSS sink (CodeBlock).** `.tsx:35` — if `shiki` throws, the fallback injected `value` (model output) straight into `dangerouslySetInnerHTML`:
  ```ts
  setHtml(`<pre><code>${value}</code></pre>`);   // BEFORE — untrusted HTML sink
  ```
  Model output must never be trusted as HTML. Now HTML-escapes `& < >` before embedding. This is defense-in-depth: the normal path uses shiki's escaped output and React escaping; the failure path is the only direct injection, and it is now closed.

**How to test:** For 1b's escape, hard to trigger externally (requires shiki to fail). Manual sanity: a normal code block still highlights; nothing else changed. The live signal is covered by the visible streaming behavior described in 1a and by the tests.

### 1c. `perf: debounce conversation persistence during streaming` — `703265c`

**File:** `src/components/AppShell.tsx`

**Why.** Audit finding: an effect keyed on `conversations` called `saveConversations(...)` (a synchronous full-history `localStorage.setItem`) on **every** state update. Because the streaming block updates `conversations` per-token, this meant a full synchronous localStorage write per token — measurable main-thread jank on long chats with large histories, and a real hotspot on big documents. I confirmed with the streaming path that the per-token `setConversations` is still necessary for live render (it must stay), so the fix wraps only the *persistence* side in a **300 ms debounce** with a teardown flush on `beforeunload` / `pagehide` / unmount, so:
- live streaming render is unchanged (state still updates per token),
- disk writes collapse to at most ~3/s during a stream,
- nothing is lost on tab close or route change (the flush covers it).

Pending-state ref + timer are cleaned up on unmount. No behavior change to undo/redo or cross-tab sync (there is none today).

**How to test:** `npm run dev`, start a long streaming reply, open DevTools → Performance and watch the main thread (or just feel the input responsiveness). Verify a conversation survives a hard tab close mid/near-end of streaming (the flush writes it). Existing conversation flow and reload-behavior are unchanged (already covered by manual reload in 1a).

---

## 2. Audit findings

Audit was read-through + targeted verification across the whole tree (types, adapter, stream parser, tool loop, bare-thought guard, web search, RAG ingest/retrieve, API routes, all client components, stores, config). Severity: **High / Medium / Low / Info**. Fixes made are listed in §1.

### Fixed (this session)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| F1 | **High** | `CodeBlock` shiki-failure fallback injected unescaped model output into `innerHTML` (XSS sink). | Escaped `& < >` before embedding (commit `a3e06d4`). |
| F2 | **High** | Thinking panel never auto-expanded while streaming (wrong live signal — last group is the text answer, not thought). P0 core behavior. | Flattened to `isStreaming` signal (commit `a3e06d4`, logic landed in `a229cce`). |
| F3 | **Medium** | Full-history `localStorage.setItem` on every token during streaming (per-token synchronous disk write). | 300 ms debounce + teardown flush (commit `703265c`). |
| F4 | **Low** | Wasted render: `ThinkingPanel` was only usable for the last group; threw away the timeline across interleaved text/thought groups. | Grouping in `MessageAssistant` → one timeline per contiguous thought-run (commit `a229cce`). |

### Known / intentionally-skipped (need a human or a larger change — see §3)

| # | Sev | Area | Finding |
|---|-----|------|---------|
| S1 | **Medium** | `AppShell` | `handleSend` / `handleRetry` and their related state (controllers, conversation payload) are near-duplicates; two code paths can drift and streaming-abort wiring is mirrored in both. Refactor is behavioral and touches request assembly — skipped per HARD RULE (risky, ambiguous) and logged. |
| S2 | **Medium** | Tool loop / chat route | On a follow-up turn, the *whole assistant message* (including the `<step>` / `<tool_results>` / `<action>` markup the model produced) is re-sent as history. The model then sometimes re-emits or re-invokes stale tool narration. Safe fix is non-trivial — it means sanitizing client-sent history for tool tags, which changes the reasoning context. Skipped; logged. |
| S3 | **Low** | `AppShell` / Sidebar | There is **no UI to delete a conversation** (data can be cleared only by wiping localStorage). A deliberate product gap, not a bug, but noteworthy. |
| S4 | **Info** | `ArtifactViewer` | Iframe preview uses `sandbox="allow-scripts allow-forms allow-popups"` **without** `allow-same-origin` — this is the correct, least-privilege posture for untrusted HTML (same-origin is intentionally withheld so script can't reach the app). No change needed; recorded so it isn't "fixed" wrongly later. |
| S5 | **Info** | Chat flow | The default backend (`cogito.py`) persona encourages `<confidence>…</confidence>` narration. The bare-thought guard and panel already treat these blocks as internal (stripped / not shown). Fully server-side behavior — out of scope, noted for operator awareness. |
| S6 | **Info** | Misc | Various minor drifts already known to the project (web-search toggle not rendered in `Composer.tsx`, `AppShell` flag not persisted) — these are documented in `CLAUDE.md` "Workflow expectations" and predate this session; not re-fixed here (they're product decisions). |

### Audit notes (no action)

- **API surface:** single `ChatBackend` / `OpenAiClient` adapter held in every route via `backend-config.ts`; `HTTP-Referer` / `X-Title` / `User-Agent` headers sent as required. Compliant with CLAUDE.md.
- **SSE parsing:** `stream-parser.ts` is strict — malformed upstream chunks are dropped with `waiting_for_data`, never crashing the route. Good.
- **Bare-thought guard:** continuation turns are strictly bounded (single `wrapWithBareThoughtGuard`); no infinite-loop risk observed. The tool loop is capped at 3 turns.
- **Retrieval:** hybrid dense+BM25 with RRF; embedding failures fall back to FTS-only; dimension mismatch is rejected at ingest. Server-only as CLAUDE.md requires.
- **Auth / secrets:** configuration API is bound to the local dev server; no auth/payment/deletion logic exists anywhere. No secrets in the repo (only `.env.local.example`, `.gitignore` covers `/data` and `.env*`). Nothing to fix.
- **No telemetry:** only outbound calls are the configured backend, its embeddings endpoint, and DuckDuckGo when the toggle is on.
- **TS hygiene:** `tsc --strict` clean at baseline and after every commit.

---

## 3. Decisions needing a human

1. **`S1` — refactor the two send/retry paths** in `AppShell.tsx`. It's the biggest structural debt left. It will touch request assembly and streaming-abort state; I recommend a follow-up session with eyes on it.
2. **`S2` — stop re-sending tool markup in follow-up history.** Decide the policy: strip `<step>`/`<tool_results>`/`<action>` from client-sent history (keeps the model from re-invoking stale tools) vs. leave as-is (richer context, occasionally noisy). This affects model quality on multi-turn + web-search conversations.
3. **`S3` — delete-conversation UI.** Product decision: minimal context-menu delete in the sidebar, or keyboard-only, or intentionally out of scope.
4. **`S5` — `<confidence>` blocks and the cogito.py persona.** The client-side handling is already correct. The real lever is server-side (persona prompt). Nothing to change in this repo.

## Definition of Done — status

- [x] Thinking panel matches the P0 spec and renders with real streaming (auto-expand while live, per-step statuses, collapsible results, truncation + show-more, interrupted/failure edge cases, persistence preserved).
- [x] `npm run build` passes with zero new errors.
- [x] `npm test` passes — 56/56 (baseline 48 + 8 new ThinkingPanel tests).
- [x] `AUTONOMOUS_REPORT.md` exists and is complete.
- [x] No HARD RULE violated. No deletions, no style rewrites, no new dependencies, no version bumps, no env/secret/history changes, no API contract changes, no force-push/reset. Build checked after every change.
- [x] Everything committed; git tree clean.