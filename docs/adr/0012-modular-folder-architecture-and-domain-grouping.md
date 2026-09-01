# ADR-0012: Modular Folder Architecture and Domain Grouping

## Status: Accepted

## Context

As Cogito evolved with features such as dynamic AI chat titling, multi-profile API routing, voice synthesis/TTS, conversation branching DAGs, and RAG document management, the codebase grew rapidly:

1. **Flat Component Directory:**
   `src/components/` contained 21 heterogeneous files in a single flat directory without domain boundaries. Layout containers (`AppShell`, `Sidebar`, `TopBar`), chat features (`ChatThread`, `Composer`, `MessageAssistant`, `MessageBubbleUser`), artifacts (`ArtifactViewer`, `CodeBlock`, `MarkdownRenderer`), and modals/views were mixed together.

2. **Unused Store Layer:**
   `src/store/` existed as an empty placeholder with a `.gitkeep`, while client-side localStorage persistence models (`conversation-store.ts`, `project-store.ts`) resided in `src/lib/`.

3. **Scattered Utilities:**
   General algorithms and client-safe helpers (`tree-utils.ts`, `title-utils.ts`, `cve-explorer.ts`) were mixed with server-side backend adapters and RAG services in `src/lib/`.

## Decision

Reorganize the project into a clean, modular, domain-driven structure following industry-standard Next.js / React best practices:

1. **Modular Components by Domain (`src/components/`):**
   - `src/components/layout/`: Top-level structural containers (`AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`).
   - `src/components/chat/`: Core conversation message stream and composer (`ChatThread.tsx`, `Composer.tsx`, `MessageAssistant.tsx`, `MessageBubbleUser.tsx`, `EmptyState.tsx`, `ThinkingPanel.tsx`, `SourceChips.tsx`, `ModelSelector.tsx`, and `__tests__/ThinkingPanel.test.ts`).
   - `src/components/artifacts/`: Interactive document rendering, sandboxing, and code presentation (`ArtifactViewer.tsx`, `CodeBlock.tsx`, `MarkdownRenderer.tsx`).
   - `src/components/projects/`: RAG knowledge base & document indexing view (`ProjectsView.tsx`).
   - `src/components/settings/`: API profile configuration and voice preferences modal (`SettingsModal.tsx`).
   - `src/components/auth/`: User authentication modal (`AuthModal.tsx`).
   - `src/components/audio/`: Voice synthesis audio playback controls (`AudioPlayerButton.tsx`).
   - `src/components/ui/`: Shared design system elements and primitives (`Icons.tsx`, `CogitoBrand.tsx`).
   - `src/components/index.ts`: Centralized barrel exports allowing flexible import styles without breaking consumers.

2. **Dedicated Client Store Layer (`src/store/`):**
   - Moved client-side persistence logic into `src/store/`:
     - `src/store/conversation-store.ts`: LocalStorage conversation persistence and DAG ID generation.
     - `src/store/project-store.ts`: Selected project persistence.
     - `src/store/index.ts`: Centralized store exports.

3. **Structured Utilities Layer (`src/lib/utils/`):**
   - Grouped helper algorithms and client utilities into `src/lib/utils/`:
     - `src/lib/utils/tree-utils.ts`: Conversation message tree branching, DAG traversal, and checkpoints.
     - `src/lib/utils/title-utils.ts`: Client-safe chat title sanitization and fallback heuristics.
     - `src/lib/utils/cve-explorer.ts`: CVE security vulnerability parsing.
     - `src/lib/utils/__tests__/tree-utils.test.ts`: Branching unit tests.
     - `src/lib/utils/index.ts`: Centralized utils barrel export.

4. **Isolated Native OS Layer (`native/windows/`):**
   - Segregated Windows desktop integration (C# `tray.cs`, precompiled `tray.exe`, PowerShell `tray.ps1`, `make-tray-icon.ps1`, `tray.log`) from Node.js scripts.
   - `bin/` contains strictly Node.js CLI executable entry points (`cogito.js`, `cogito.cmd`, `cogito.ps1`).

5. **Zero-Deletion & Import Integrity Guarantee:**
   - 100% of files are preserved with zero files deleted.
   - All relative and path-aliased imports across the entire repository were updated.

## Consequences

- Clean language separation: TypeScript/TSX lives in `src/`, Node.js CLI launchers live in `bin/`, and C# / PowerShell desktop integration lives in `native/windows/`.
- Clear domain boundaries make navigating, maintaining, and scaling the codebase significantly faster.
- Reduced cognitive load when modifying specific features (e.g. Chat UI vs Artifacts vs Settings).
- Standardized store and utility layers utilize appropriate architectural folders (`src/store/`, `src/lib/utils/`).
- Zero regression: all unit tests, compiler checks, and production builds continue to pass cleanly.

## Implementation status

- Implemented on 2026-08-26.
- Created domain directories under `src/components/`, `src/store/`, `src/lib/utils/`, and `native/windows/`.
- Moved 21 component files, 2 store files, 3 utility files, 2 test files, and 5 native Windows tray files to their modular locations.
- Created barrel export files (`src/components/index.ts`, `src/store/index.ts`, `src/lib/utils/index.ts`).
- Updated all import paths across `src/app/`, `src/components/`, `src/contexts/`, `src/store/`, `src/lib/`, `bin/cogito.js`, and tests.
- Updated `CLAUDE.md`, `AGENTS.md`, and `SECURITY.md`.
- All 120 Vitest unit tests pass and `npm run build` succeeds with 21/21 static and dynamic routes.
