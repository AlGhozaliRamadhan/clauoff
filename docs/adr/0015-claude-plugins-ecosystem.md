# ADR-0015: Claude Plugins Ecosystem and Super-Bundle Architecture

- **Status:** Accepted
- **Date:** 2026-08-27
- **Authors:** Cogito Core Team
- **Area:** Plugins, Skills, Model Context Protocol (MCP), Settings UI

---

## 1. Context and Problem Statement

Following the integration of the Claude & Agent Skills standard (ADR-0013) and Connectors & Model Context Protocol (ADR-0014), the Claude Code ecosystem introduced **Plugins** as higher-level, distributable super-bundles.

In Claude Code, a plugin package combines:
1. **Manifest (`plugin.json` in `.claude-plugin/` or root):** Standard metadata (`name`, `version`, `description`, `author`, `license`, `repository`, `homepage`).
2. **Bundled Skills (`skills/<skill-name>/SKILL.md`):** Reusable domain instruction sets, procedures, and slash commands.
3. **Bundled MCP Servers (`.mcp.json` or `mcpServers`):** Pre-configured Model Context Protocol server tools.
4. **Hooks & Lifecycle Handlers (`hooks/hooks.json`):** Event hooks (`PreToolUse`, `PostToolUse`, `SessionStart`).
5. **Commands:** Namespaced custom slash actions.

Users require:
- A unified package manager to browse, install, toggle, inspect, and uninstall Claude plugin bundles.
- 1-click curated marketplace installer for popular developer, security, devops, data, and QA suites.
- Universal GitHub / URL plugin downloader.
- An in-place Dark & White UI under Settings (`Plugins` tab) and profile popup menu shortcut.

---

## 2. Decision

We implement the Claude Plugins system according to the following architecture:

### A. Manifest Schema & Types (`src/lib/plugins/types.ts`)
- `PluginManifest`: Schema conforming to the official `.claude-plugin/plugin.json` specification with `skills`, `mcpServers`, `hooks`, and `agents`.
- `Plugin`: In-memory and storage representation with parsed bundled skills, MCP servers, and metadata.
- `CuratedPlugin`: Marketplace catalog schema.

### B. Catalog & Marketplaces (`src/lib/plugins/catalog.ts`)
- 6 curated plugin suites ready for 1-click installation:
  - **`github-workflow-suite`**: PR reviewer + Git branch manager + GitHub MCP server.
  - **`security-sentinel`**: SAST scanner + CVE remediation advisor.
  - **`devops-cloud-toolkit`**: Docker optimizer + Kubernetes manifest builder.
  - **`database-powerpack`**: SQL query optimizer + Database schema designer + Postgres MCP server.
  - **`fullstack-mastery`**: Next.js 16 App Router expert + Tailwind design system.
  - **`qa-testing-pro`**: Vitest unit tester + Playwright E2E suite.

### C. Package Manager & Storage (`src/lib/plugins/storage.ts`)
- Stored under `data/plugins/<plugin-id>/`.
- Auto-syncs bundled skills into `data/skills/` and bundled MCP servers into `data/connectors.json`.
- Supports atomic toggle (enables/disables all bundled capabilities in sync) and clean deletion.

### D. Universal GitHub Downloader (`src/lib/plugins/downloader.ts`)
- Parses GitHub repository URLs (`https://github.com/owner/repo` or `owner/repo`).
- Fetches `plugin.json`, discovers recursive git tree for `SKILL.md` files and `.mcp.json`, and installs the package locally.

### E. REST API Endpoints
- `GET /api/plugins`: Returns installed plugins and curated catalog.
- `POST /api/plugins`: Installs curated or custom plugin.
- `GET /api/plugins/[id]`: Returns plugin details.
- `PUT /api/plugins/[id]`: Toggles enabled state.
- `DELETE /api/plugins/[id]`: Deletes and unregisters plugin.
- `POST /api/plugins/download`: Downloads plugin from URL / GitHub.

### F. Dark & White In-Place Settings UI (`SettingsModal.tsx` & `Sidebar.tsx`)
- In-place Master-Detail view (`activeTab === "plugins"`):
  - **View 1 (List & Marketplace):** Installed plugins with toggle switches, bundle capability chips, and 1-click marketplace catalog.
  - **View 2 (Inspect Bundle):** Full tabs for bundled skills (with `MarkdownRenderer`), MCP tools, and raw `plugin.json` manifest with copy button.
- Profile menu in `Sidebar.tsx` includes direct **Plugins** option with `BUNDLE` badge.

---

## 3. Visual & Styling Rules

- Adheres to the strict **Dark & White** visual hierarchy:
  - White primary action buttons (`bg-white text-neutral-900 hover:bg-neutral-200`).
  - Dark subtle container cards and frosted glass badges.
  - Zero gaudy orange dominant buttons.

---

## 4. Implementation Status

| Component | Status | Details |
|---|---|---|
| `src/lib/plugins/types.ts` | Complete | Plugin manifest and bundle types |
| `src/lib/plugins/catalog.ts` | Complete | 6 curated Claude plugin suites |
| `src/lib/plugins/storage.ts` | Complete | Package manager and `data/plugins/` persistence |
| `src/lib/plugins/downloader.ts` | Complete | Universal GitHub repository downloader |
| `src/app/api/plugins/*` | Complete | REST API handlers (list, install, toggle, delete, download) |
| `src/components/settings/SettingsModal.tsx` | Complete | In-place Master-Detail Dark & White UI |
| `src/components/layout/Sidebar.tsx` | Complete | Profile dropdown shortcut with `BUNDLE` badge |
| `test/plugins/*` | Complete | Unit tests for storage, catalog, and lifecycle |
