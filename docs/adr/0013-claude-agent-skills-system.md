# ADR-0013: Claude & Agent Skills System (Open Standard SKILL.md)

## Status: Accepted

## Context

Users requested the ability to use Claude Skills in Cogito — matching the open Agent Skills standard (`SKILL.md` with YAML frontmatter) and enabling:
1. Downloading and installing skills from GitHub repositories, directories, or direct URLs.
2. Progressive disclosure of skills to avoid overwhelming model context windows (compact discovery manifest injected at startup, full instructions body injected on activation).
3. Invoking skills seamlessly via slash commands (e.g. `/code-reviewer`, `/commit-message-generator`).
4. Accessing the Skills management view directly when clicking the user profile menu in the sidebar.
5. Managing, creating, inspecting, editing, toggling, and deleting skills locally.

## Decision

1. **Standard `SKILL.md` Parser & Storage (`src/lib/skills/`):**
   - Implemented zero-dependency YAML frontmatter parser and serializer (`parser.ts`) supporting metadata (`name`, `description`, `license`, `compatibility`, `allowed-tools`, `metadata`) and markdown instructions.
   - Standardized local persistence under `data/skills/<name>/SKILL.md` (and `data/skills/skills-config.json` for enable/disable toggles and source tracking) via `storage.ts`.
   - Seeded 10 battle-tested curated skills (`catalog.ts`): `code-reviewer`, `commit-message-generator`, `consolidate-deps`, `security-auditor`, `doc-generator`, `refactor-clean-code`, `test-engineer`, `prompt-optimizer`, `api-designer`, and `regex-master`.

2. **Universal Skill Downloader (`downloader.ts`):**
   - Translates GitHub repository URLs, `tree/<branch>/<path>` subfolders, `blob/<branch>/SKILL.md` files, and raw links to fetch and validate remote `SKILL.md` packages with 1-click installation.

3. **Progressive Disclosure & Slash Command System (`context.ts`, `tools.ts`, `chat/route.ts`):**
   - Lightweight `<available_skills>` manifest is injected during tool prompt creation for enabled skills.
   - Added `load_skill` agent tool so the model can autonomously request full instructions when needed.
   - If the user starts a prompt with a slash command (e.g. `/<skill-name>`), the full instructions are dynamically injected with high-priority execution framing.

4. **Interactive Settings & Profile Navigation (`SettingsModal.tsx`, `Sidebar.tsx`, `Composer.tsx`):**
   - Added a "Skills" menu item with `SKILL.MD` badge to the profile popup menu in `Sidebar.tsx`, opening `SettingsModal` directly to the `skills` tab (`initialTab="skills"`).
   - Created full-featured Skills management tab in `SettingsModal.tsx` supporting:
     - **Installed Skills**: active/disabled toggle switches, search filter, raw `SKILL.md` inspector, in-place skill editor/creator, and deletion.
     - **Curated Catalog**: categorized skill cards with 1-click installation and live preview.
     - **Download Dialog**: URL / GitHub importer with custom name override.
   - Added live slash-command auto-complete popup in `Composer.tsx` when typing `/`.

## Consequences

- Cogito natively supports the open Claude and Agent Skills standard (`SKILL.md`).
- Skills are completely portable and can be downloaded from any public GitHub repository or curated list.
- Context window efficiency is preserved via progressive disclosure.
- Users have full local control over all installed skills directly through the profile menu and settings UI.

## Implementation status

- Implemented on 2026-08-26.
- Created `src/lib/skills/types.ts`, `src/lib/skills/parser.ts`, `src/lib/skills/catalog.ts`, `src/lib/skills/storage.ts`, `src/lib/skills/downloader.ts`, `src/lib/skills/context.ts`, and `src/lib/skills/index.ts`.
- Added endpoints: `GET/POST /api/skills`, `GET/PUT/DELETE /api/skills/[name]`, `POST /api/skills/download`.
- Updated `src/lib/agent/tools.ts`, `src/app/api/chat/route.ts`, `src/components/layout/Sidebar.tsx`, `src/components/layout/AppShell.tsx`, `src/components/settings/SettingsModal.tsx`, and `src/components/chat/Composer.tsx`.
- Created comprehensive test suite under `test/skills/` (`parser.test.ts`, `storage.test.ts`, `downloader.test.ts`, `context.test.ts`) and updated `test/agent/tools.test.ts`.
- All 137 Vitest tests pass and Next.js production build (`npm run build`) succeeded across all 23 routes.
