# ADR-0010: Deferral of Dependabot PRs #14 and #12 in the 2026-08-26 consolidation

## Status: Accepted (deferral)

## Context

The 2026-08-26 `/consolidate-deps` pass opened against five open
Dependabot PRs:

- #16 next 16.3.1 → 16.3.2 — patch, merged.
- #13 eslint-config-next 16.2.10 → 16.3.2 — patch, merged.
- #15 vitest 3.2.4 → 4.1.11 — major, merged.
- #14 eslint 9.39.4 → 10.9.0 — major, **deferred** by this ADR.
- #12 @types/node 20.19.43 → 26.2.0 — major, **deferred** by this ADR.

The skill's gate is real verification: `npm run build` + `npm test` +
`npm run lint` must all pass before a major lands. The skill's rule on
deferral is explicit:

> Never ship a broken core workflow (lint, build, test) to land a
> bump. Defer and document instead.

For #14 and #12, the verification gate could not be exercised for the
following reasons:

1. **eslint 9 → 10 (`#14`):** ESLint 10 changed the flat-config default
   and the plugin/preset compatibility surface. The repo's lint setup
   uses `eslint-config-next@16.3.2` (already merged in this pass),
   which has not yet been validated against ESLint 10 in this
   environment. Without a clean `npm run lint` against ESLint 10,
   merging the bump would risk silently shipping a broken lint path.
   The `typescript-eslint` package (peer-pinned to TS 5.x) also has a
   not-yet-validated compatibility story with ESLint 10.

2. **@types/node 20 → 26 (`#12`):** Node 26 type stubs declare APIs
   that are not present in Node 20 LTS. The repo currently targets
   the Node 20 type line. Bumping to 26 without `tsc --noEmit` and
   `npm run build` against the new types is a known footgun: even
   when no code uses a Node 26-only API, ambient declarations in
   the new types can still surface as type errors in transitive
   imports.

## Decision

- **#14 (eslint 9 → 10) is deferred.** Pinned at `^9.39.4` in
  `package.json`. Re-enable condition: the next consolidation cycle
  must verify `npm run lint` against ESLint 10 *and* ESLint 10 + the
  then-current `eslint-config-next` and `typescript-eslint` peers
  must be green together. If any of those fail, this deferral rolls
  forward to the next cycle with the exact error captured in the new
  PR.
- **#12 (@types/node 20 → 26) is deferred.** Pinned at `^20` in
  `package.json`. Re-enable condition: the next consolidation cycle
  must verify `tsc --noEmit` and `npm run build` against the new
  type stubs. If those fail, this deferral rolls forward.

## Consequences

- This release ships next 16.3.2, eslint-config-next 16.3.2, and
  vitest 4.1.11 only.
- Two Dependabot PRs (#12, #14) remain open against `main` and will
  be auto-bumped by Dependabot. The next `/consolidate-deps` cycle
  will pick them up again.
- The deferral is **explicit and time-bounded** — not "ship and
  forget". The PR body for this release links this ADR by file
  name so the next agent can find it.

## Implementation status

Accepted on 2026-08-26. Recorded as the closure rationale for
Dependabot PRs #12 and #14, and as the body of the consolidation PR.
No code change beyond the existing pinned versions in `package.json`.
