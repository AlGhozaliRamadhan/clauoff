# ADR-0006: Web Search Capability

## Status: Accepted (amended 2026-08-11)

## Context
Users want the AI to be able to search the web when it encounters questions
it cannot confidently answer from its training data alone — e.g. recent
events, facts that change over time (prices, versions, availability), or
topics outside its knowledge. This is similar to how Claude, ChatGPT, and
other frontier AI products offer "web search" as an augmentation tool.

### Tension with offline-first principle
ADR-0001 and the project README establish Cogito as an **offline-first**
tool with no outbound calls except to the user's configured LLM backend.
Web search is an intentional, user-initiated departure from that principle
— similar to how RAG (ADR-0005) already calls the backend's embeddings
endpoint.

### Why this decision was amended
The original decision made web search a **user-controlled, per-message
toggle, off by default**. In practice this is friction: users should not
have to predict when a search is useful, and the model is better positioned
than the user to know when its own knowledge is uncertain or stale. The
implementation also drifted from the ADR — the per-message toggle was never
wired into the UI; a global flag in `AppShell.tsx` (defaulting to **on**)
controls whether the tool is offered at all. This amendment aligns the
documented decision with the implemented behavior and with the stronger
product goal: **the model decides whether to search, and is smart about it.**

## Decision (amended)

1. **Model-driven tool use.** The model decides, for each message, whether
   a web search is warranted. The user does not pre-select "search this
   message". The model expresses intent by emitting
   `<action name="search_web">query</action>` inside its response; the
   server intercepts it, performs the search, injects the results, and lets
   the model finish its answer informed by them.
2. **Smart usage policy.** The model is instructed to search when:
   - It is **uncertain** about the facts.
   - The answer **may have changed** since its training: news, current
     events, prices, versions, releases, specs, availability, weather.
   - The user explicitly asks for **up-to-date or verified** information.
   - The question falls **outside its training knowledge**.
   
   And **not** to search when:
   - The answer is stable, well-known knowledge the model is confident in.
   - The task is creative, opinion-based, or purely conversational.
   - The question is about the conversation itself (summarizing, editing,
     or explaining code already present in the chat).
   
   The policy is delivered as part of the tools prompt that `/api/chat`
   injects whenever the capability is enabled.
3. **UI control is a capability switch, not a trigger.** The UI (global
   state in `AppShell`, default **on**) determines whether the model is
   offered the search tool at all. When enabled, the model decides per
   message under the smart usage policy. When disabled, the tool is never
   offered and no search can occur — this preserves the offline-first
   default for users who want it. Forcing a search on a specific message is
   a possible future refinement, not v1 behavior.
4. **Server-side only:** The browser never calls external search APIs
   directly. All search traffic goes through the Next.js Route Handler
   (`/api/search` or the agent loop inside `/api/chat`), keeping the same
   proxy architecture as chat (ADR-0001).
5. **Search provider: multi-provider fallback.** The search module uses a
   three-tier strategy for reliability:
   - **Primary:** DuckDuckGo HTML endpoint (real web search results, no API
     key). The server scrapes the static HTML version at
     `html.duckduckgo.com/html/` and parses title/URL/snippet from the
     response.
   - **Fallback:** Wikipedia API (reliable knowledge lookups when DDG fails
     or returns empty).
   - **Supplement:** DuckDuckGo Instant Answer API (adds quick facts and
     definitions if result count is low).
   All providers include abort-controller timeouts (6-10s). The main
   `webSearch()` function **never throws** — it gracefully falls through
   providers and returns an empty array if all fail. This eliminates the
   "network error" crash that previously occurred when search failed during
   a model's thinking phase.
6. **Privacy:** Search queries are derived from the user's message by the
   LLM. No user data, conversation history, or identifiers are sent to the
   search provider beyond the search query string.
7. **Streaming UX:** Because the model can trigger a search without the
   user asking for one, the UI must always show what is happening: a
   "Searching the web…" indicator while the search executes, then the
   streamed final answer.

## Implementation details

### Files (all implemented)
- `src/lib/web-search.ts` — multi-provider search module:
  `duckDuckGoSearch()` (HTML scraping), `wikipediaSearch()` (API fallback),
  `duckDuckGoInstantAnswer()` (supplementary), and
  `formatSearchResultsForLLM()` for injecting results into model context.
- `src/app/api/search/route.ts` — standalone search route (for direct or
  future use).
- `src/app/api/chat/route.ts` — when the capability is enabled, injects
  the tools prompt (tool schema + smart usage policy) into the
  conversation, then runs the agentic tool loop instead of the direct
  stream.
- `src/lib/agent/tool-loop.ts` — reads the backend stream, intercepts
  `<action name="search_web">`, executes the search server-side, appends
  the action result to the message history, and continues until the model
  stops emitting actions (max 5 turns). Includes defensive error handling
  at every critical point: backend connection failures, tool execution
  errors, and mid-stream disconnections all produce graceful fallback
  messages instead of crashing the stream.
- `src/components/AppShell.tsx` — global `webSearchEnabled` state (default
  `true`), sent as `webSearch` with every `/api/chat` request.
- `src/components/MessageAssistant.tsx` — "Searching the web…" indicator,
  parsed from `<step>` / `<search>` markers in the streamed text.

### Note on the UI toggle
`Composer.tsx` declares `webSearchEnabled` / `onWebSearchToggle` props for
future UI wiring, but no toggle control is rendered today; the capability
is controlled solely by the AppShell flag. Wiring a visible capability
switch (or a per-conversation override) is tracked in Next steps.

### Environment variables
None required (DuckDuckGo needs no API key).
Optional future: `SEARCH_PROVIDER=duckduckgo` for swappable providers.

## Consequences
- Cogito is no longer purely offline when web search is enabled — it is a
  capability the model may exercise at its own judgment.
- No API keys or accounts needed — DuckDuckGo is free and keyless.
- The smart usage policy keeps searches purposeful: the model avoids
  burning a search where its own confident knowledge suffices, and uses
  one when uncertainty or recency demands it.
- Because the model decides, searches can be triggered without the user
  explicitly requesting them — the visible indicator is required so the
  user always understands why a search happened.
- Users who want a strictly offline experience disable the capability.

## Next steps
- [x] Implement `src/lib/web-search.ts`
- [x] Integrate agentic search loop in chat route
- [x] Add search indicator UI
- [ ] Tune the smart usage policy from real usage (watch for
      over-triggering on easy questions and under-triggering on stale
      facts) — adjust the policy text in `/api/chat`'s tools prompt.
- [ ] Render the Composer toggle as a visible capability switch, and/or
      add a per-conversation override.
