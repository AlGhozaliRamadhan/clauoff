# Security Policy

## Supported Versions

Cogito is under active development. The current `main` branch is the only supported release stream. No stable release tags exist yet, so there are no versioned branches with separate support windows.

| Version | Supported |
|---------|-----------|
| `main` (unreleased) | ✅ Supported |
| All other branches | ⚠️ Best effort (development only) |

## Reporting a Vulnerability

Please do **not** open a public issue for a security vulnerability. Instead, report it privately so it can be fixed and disclosed responsibly.

**How to report:**

1. Open a **private vulnerability report** on GitHub:
   https://github.com/AlGhozaliRamadhan/clauoff/security/advisories/new
   (Security tab → "Report a vulnerability" → "New advisory")
2. Include in the report:
   - A concise description of the issue and the impact if exploited
   - The affected module or endpoint (e.g. an API route, a frontend component, a RAG processor)
   - Steps to reproduce or a proof-of-concept
   - Any suggested fix, if you have one

**What happens next:**

- You will get an acknowledgment within **3 business days**.
- You will get a status update within **10 business days** with the triage result (confirmed / not confirmed / out of scope).
- If confirmed, a fix is targeted for the next release and coordinated with the reporter before any public disclosure.
- If the report is declined, the reasoning will be shared.

## Scope

Cogito is a local-first chat application. Reports are in scope when they touch any of:

- The Next.js route handlers (`src/app/api/**`)
- The RAG pipeline ([`src/lib/rag/**`](src/lib/rag)) including PDF extraction and on-disk project data under `data/`
- The web-search integration ([`src/lib/web-search.ts`](src/lib/web-search))
- The OpenAI-compatible backend client ([`src/lib/openai-client.ts`](src/lib/openai-client))
- Client-side state and rendering, in particular anything that renders model output
  ([`src/components/artifacts/CodeBlock.tsx`](src/components/artifacts/CodeBlock.tsx), [`src/components/artifacts/MarkdownRenderer.tsx`](src/components/artifacts/MarkdownRenderer.tsx))

**Known surfaces and current posture:**

- **Model output is untrusted.** Code blocks and markdown are rendered with escaping; the artifact viewer's iframe runs with `sandbox="allow-scripts allow-forms allow-popups"` and no `allow-same-origin`. Treat any new render path for model output as a review boundary.
- **Backend credentials** live in `data/cogito-config.json` and `.env.local`, both gitignored. Never rely on these being out of reach of another local process; an attacker with local file access is out of scope.
- **No telemetry.** The app makes outbound calls only to the user-configured backend, its embedding endpoint, and DuckDuckGo (when the web-search toggle is on).

## Out of scope

- Attacks requiring local filesystem or process access on the machine running the app
- Social engineering of the operator
- Denial of service of the user's configured backend (other than through the app itself)
- Dependency vulnerabilities that are already tracked by Dependabot alerts

## Dependency monitoring

Dependency updates are monitored via Dependabot (weekly) and by alerts on the default branch. The consolidated dependency release process groups these updates into a single verified PR. If you report a dependency vulnerability that Dependabot has already opened a pull request for, that PR is the fix path and a duplicate advisory is not needed.

## Security updates for this file

This policy is periodically reviewed. The supported-versions table and response windows are the source of truth; suggested changes should be made in a pull request.