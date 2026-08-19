# Cogito

A chat app that talks to whichever LLM backend you configure. It replicates the Claude.ai-style chat interaction design, with streaming responses, a thinking panel, markdown rendering, and code artifacts, but there is no Anthropic API call anywhere in the code. The backend is a generic OpenAI-compatible API: LM Studio, Ollama's `/v1`, a Cloudflare-tunneled endpoint, anything that speaks that protocol.

Two capabilities sit on top of plain chat:

- **Projects + RAG.** Your documents live in per-project libraries on disk under `data/`. They are chunked, embedded through your backend's `/embeddings` endpoint, and stored in a SQLite database with FTS5 and dense vectors. Chat retrieves context from the bound project and cites its sources.
- **Web search.** The model decides when a search is called for, using a declarative tool registry. The first and only tool is `search_web`, a keyless DuckDuckGo lookup. A switch in the UI turns tool use on or off.

## Getting started

You need Node.js and a running OpenAI-compatible backend.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first run, open the Settings modal and point Cogito at your backend. The active API profile is stored in `data/cogito-config.json` and can be changed at any time; there is no build-time config. If no profile exists yet, the values in `.env.local` are used as fallbacks:

```env
BACKEND_BASE_URL=http://localhost:20128/v1
BACKEND_API_KEY=
DEFAULT_MODEL=ollama/minimax-m3
EMBEDDING_MODEL=text-embedding-3-small
```

`EMBEDDING_MODEL` is only needed for project ingest. It must be a model id your backend serves through `POST /embeddings`. `DATA_DIR` overrides the default `<cwd>/data` location for project libraries.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server on http://localhost:3000 |
| `npm run build` | Production build (`next build`) |
| `npm run lint` | ESLint with the Next.js config and TypeScript |
| `npm test` | Run the Vitest suite |

## How it fits together

- One backend adapter, `OpenAiClient`, speaks to `/chat/completions` and `/models`. The browser never calls your backend directly; every request goes through the Next.js route handlers in `src/app/api/`.
- Chat, RAG retrieval, and web search all run server-side. The UI keeps conversations and your active project in browser storage, so a server restart keeps your chats.
- Markdown and code blocks are the render path for assistant output. Code blocks can be opened in a side-by-side artifact view.
- Design tokens live in `src/app/globals.css` as CSS variables, dark-first with a light theme.

## Documentation

Architecture decisions are recorded as ADRs in `docs/adr/`:

- ADR-0006: web search capability
- ADR-0007: agentic tool registry
- ADR-0008: dependency consolidation and toolchain pinning