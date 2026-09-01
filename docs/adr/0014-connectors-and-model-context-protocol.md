# ADR-0014: Connectors and Model Context Protocol (MCP) Integration

- **Status:** Accepted
- **Date:** 2026-08-27
- **Authors:** Cogito Core Team
- **Area:** Connectors, Agent Tool Registry, Model Context Protocol (MCP)

---

## 1. Context and Problem Statement

Cogito provides an agentic tool loop (ADR-0007) and an open Agent Skills system (ADR-0013). However, modern LLM workflows and Claude-style environments increasingly rely on **Connectors** and external protocol bridges—specifically the open **Model Context Protocol (MCP)** specification—to interface dynamically with databases, local filesystems, GitHub, search engines, browser automation, and custom webhooks.

Users require:
1. **Built-in Connectors:** Native zero-config integration for Web Search (DuckDuckGo), CVE Security Explorer (NIST NVD & OSV), Python Sandbox execution, Workspace Filesystem reader, and GitHub source code explorer.
2. **Model Context Protocol (MCP) Stdio & SSE Support:** The ability to attach any local MCP server process (`npx`, `python`, `uvx`, `node`) or remote HTTP/SSE MCP endpoint, automatically discover tools via `tools/list`, and execute tools via `tools/call` JSON-RPC protocol.
3. **Connectors Configuration & Management UI:** An in-place Dark & White UI in Settings (`Connectors` tab) and profile menu shortcut to enable/disable connectors, test connections with live latency metrics, inspect tool schemas, and install presets from an MCP catalog.
4. **Dynamic Tool Registry Bridge:** Seamless runtime bridging so all tools from enabled connectors are dynamically resolved, injected into the model prompt `<tool>` manifest, and routed through the agent loop (`runAgenticToolLoop`).

---

## 2. Decision

We implement the Connectors and Model Context Protocol architecture across the following layers:

### A. Types & Data Structures (`src/lib/connectors/types.ts`)
- `Connector`: Schema holding ID, name, description, `type` (`builtin` | `mcp_stdio` | `mcp_sse` | `custom_http`), `category` (`search` | `security` | `developer` | `data` | `mcp` | `custom`), `status` (`ready` | `connected` | `error` | `disabled`), configuration, and discovered `tools`.
- `ConnectorConfig`: Stores command, arguments, environment variables, endpoint URL, headers, and timeout.

### B. Catalog & Presets (`src/lib/connectors/catalog.ts`)
- Pre-seeds 5 built-in connectors:
  - `builtin-web-search`: DuckDuckGo & URL fetcher (`search_web`, `fetch_web_page`)
  - `builtin-cve-explorer`: NIST NVD & OSV security inspector (`cve_explorer`)
  - `builtin-python-sandbox`: Python interpreter (`run_python`)
  - `builtin-filesystem`: Workspace directory & file reader (`list_directory`, `read_project_file`)
  - `builtin-github`: Public GitHub repository explorer (`github_fetch_repo`, `github_read_file`)
- Pre-configured catalog presets for official MCP servers:
  - Local File System (`@modelcontextprotocol/server-filesystem`)
  - GitHub Server (`@modelcontextprotocol/server-github`)
  - PostgreSQL Database (`@modelcontextprotocol/server-postgres`)
  - Brave Search (`@modelcontextprotocol/server-brave-search`)
  - Puppeteer Browser Automation (`@modelcontextprotocol/server-puppeteer`)
  - Knowledge Graph Memory (`@modelcontextprotocol/server-memory`)
  - Remote MCP Server over HTTP/SSE
  - Custom REST API Webhook

### C. MCP Client Adapter (`src/lib/connectors/mcp-client.ts`)
- Implements JSON-RPC 2.0 transport over Stdio (`child_process.spawn`) and HTTP/SSE.
- Runs MCP lifecycle handshake: `initialize` → `notifications/initialized` → `tools/list` → `tools/call`.
- Converts MCP JSON schemas into Cogito agent tool definitions with usage examples.

### D. Storage & State Persistence (`src/lib/connectors/storage.ts`)
- Persists user configurations under `data/connectors.json` (gitignored).
- Exposes `listConnectors()`, `getConnector()`, `saveConnector()`, `toggleConnector()`, `deleteConnector()`, and `testConnector()`.
- Automatically protects built-in connectors from deletion while allowing toggle/configuration.

### E. Dynamic Tool Registry Bridge (`src/lib/connectors/registry.ts` & `src/lib/agent/tools.ts`)
- `getAllActiveTools()` dynamically aggregates core built-ins and active connector tools.
- `findTool(name)` dynamically resolves custom and MCP tools during agent stream execution.
- Chat route (`src/app/api/chat/route.ts`) builds the model-visible manifest using `getAllActiveTools()`.

### F. REST API Endpoints
- `GET /api/connectors`: Lists all configured connectors and MCP catalog presets.
- `POST /api/connectors`: Creates or updates a connector.
- `GET /api/connectors/[id]`: Returns connector details and live tools.
- `PUT /api/connectors/[id]`: Toggles enabled state or updates configuration.
- `DELETE /api/connectors/[id]`: Deletes custom connectors.
- `POST /api/connectors/[id]/test`: Performs live health check, latency measurement, and tool discovery.

### G. UI Integration (`SettingsModal.tsx` & `Sidebar.tsx`)
- In-place Dark & White Master-Detail router under `activeTab === "connectors"`.
- View 1 (`list`): Filterable grid of active connectors + MCP catalog presets, with live status pills, test buttons, tool chips, and toggle switches.
- View 2 (`detail`): Back navigation, configuration inspector, connection test banner with millisecond latency, and full tool schemas.
- View 3 (`edit`): Clean dark form controls for stdio commands/args/env or HTTP/SSE endpoints with white "Save Connector" button.
- Profile menu in `Sidebar.tsx` includes a direct "Connectors" option with `MCP` badge.

---

## 3. Visual & Styling Consistency

- Follows the strict **Dark & White** design tokens:
  - Primary buttons: High-contrast crisp white (`bg-white text-neutral-900 hover:bg-neutral-200`).
  - Secondary buttons: Subtle dark neutral (`bg-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.12)] text-white`).
  - Active subtab pills: Solid white background with dark text.
  - Badges: Frosted neutral glass (`bg-[rgba(255,255,255,0.06)] text-neutral-300`).
  - Zero gaudy orange dominant buttons.

---

## 4. Implementation Status

| Component | Status | Details |
|---|---|---|
| `src/lib/connectors/types.ts` | Complete | Schema definitions for connectors, MCP configs, tools |
| `src/lib/connectors/catalog.ts` | Complete | 5 built-in connectors + 8 MCP catalog presets |
| `src/lib/connectors/mcp-client.ts` | Complete | JSON-RPC 2.0 stdio and HTTP/SSE MCP client |
| `src/lib/connectors/storage.ts` | Complete | `data/connectors.json` persistence and state manager |
| `src/lib/connectors/registry.ts` | Complete | Dynamic tool bridge and action router |
| `src/app/api/connectors/route.ts` | Complete | REST API handlers |
| `src/components/settings/SettingsModal.tsx` | Complete | In-place dark & white Connectors UI |
| `src/components/layout/Sidebar.tsx` | Complete | Profile dropdown shortcut with `MCP` badge |
| `test/connectors/*` | Complete | 100% test pass (storage, registry, mcp-client) |
