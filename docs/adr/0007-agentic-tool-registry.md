# ADR-0007: Agentic Tool Registry

## Status: Accepted

## Context
ADR-0006 introduced agentic web search: the model emits
`<action name="search_web">query</action>`, the server intercepts it inside
`src/lib/agent/tool-loop.ts`, executes a DuckDuckGo search, injects the
results, and continues the stream. It works, but the tool is **hardcoded in
two places**:

1. `src/app/api/chat/route.ts` — the tools prompt is a template literal that
   only describes `search_web`.
2. `src/lib/agent/tool-loop.ts` — dispatch is `if (match[1] === "search_web")`.

The model's answer to "what tools do I have?" is fixed text, not data. Every
future tool (browse a URL, run a command, query a local API, …) would mean
editing both files and duplicating the prompt-building and dispatch logic.
ADR-0007 generalizes the ADR-0006 `<action>` protocol into a **registry**:
one place declares what tools exist, what each does, when it should be used,
and how to execute it. The model reads the manifest to choose; the server
dispatches by name.

## Decision

1. **A tool is a data object, not a branch of code.**
   ```ts
   interface ToolDefinition {
     name: string;             // must match <action name="...">
     description: string;      // what it does — shown to the model
     usage?: string;           // smart-usage policy for this tool
     execute(input: string): Promise<ToolExecution>;  // server-side
   }

   // What a tool returns: text for the model + optional structured status
   // for the UI (e.g. the collapsible search-results list).
   interface ToolExecution {
     modelContext: string;     // fed back as <action_result>
     status?: ToolStatus;      // { label, items: [{title,url,snippet}] } → <tool_results>
   }
   ```
2. **One registry module** (`src/lib/agent/tools.ts`) exports the `TOOLS`
   array plus `buildToolsPrompt()` (generates the `<tool>` manifest the
   model reads to answer "what tools do I have?") and `findTool()` (name →
   definition).
3. **The agent loop dispatches generically:** parse
   `<action name="X">input</action>`, look up `X` in the registry, call
   `execute`, append the result as `<action_result>`, continue. Unknown or
   malformed actions are flushed to the client as plain text — same as the
   current fallback for non-`search_web` tags.
4. **The smart-usage policy lives with the tool.** The usage rules from
   ADR-0006 become the `usage` field on the `search_web` definition and are
   rendered into the manifest. Each future tool carries its own judgment
   rules.
5. **Adding a tool = one new entry in the registry.** No edits to
   `tool-loop.ts` or `chat/route.ts`. This mirrors ADR-0002's "one new
   adapter file" rule for backends.

### Protocol (unchanged from ADR-0006)
The model signals intent by emitting `<action name="X">input</action>`.
The server streams everything before the tag to the client, executes the
tool, and feeds the result back. The UI's parsing of `<step>` /
`<search>` markers in `MessageAssistant.tsx` is unaffected.

## Implementation details

### New file
- `src/lib/agent/tools.ts` — `ToolDefinition`, `TOOLS` registry, 
  `buildToolsPrompt()`, `findTool()`.

### Modified files
- `src/app/api/chat/route.ts` — replace the hardcoded tools prompt with
  `buildToolsPrompt(TOOLS)`.
- `src/lib/agent/tool-loop.ts` — replace the `search_web`-specific branch
  with registry lookup + generic dispatch.

## Consequences
- The model's tool knowledge becomes declarative; the agent loop is now
  tool-agnostic and can grow new capabilities without structural changes.
- Tool execution is server-side only, preserving the ADR-0001 proxy
  architecture and the offline-first / opt-in posture of ADR-0006.
- Slight abstraction cost (registry indirection) over the current two-site
  hardcode, justified once a second tool exists.
- Future tool additions still need their own review (privacy, cost,
  security) — the registry is a mechanism, not a policy approval.

## Next steps
- [x] Create `src/lib/agent/tools.ts` with `search_web` as the first tool
- [x] Migrate `chat/route.ts` prompt building to the registry
- [x] Migrate `tool-loop.ts` dispatch to the registry
- [x] Stream structured results to the UI (`<tool_results>` tag) for the
      collapsible search-results list, and keep tool status narration
      (`<step>`) inside the thought process rather than visible text
- [x] Model-output discipline via the manifest: always think inside
      `<think>…</think>`, never narrate tool failures/mechanics, no
      "Final answer:" prefixes, no repetition; `frequency_penalty: 0.6`
      on all chat requests to suppress repetition loops
