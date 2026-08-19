# ADR-0008: Dependency Consolidation and Toolchain Pinning

## Status: Accepted

## Context

Dependabot opens individual pull requests per package bump. On a repo like
this, that produces a scattered pile of PRs (nine were open at once) that:

1. **Conflict with each other.** Two PRs bumped `next` to different
   versions (`16.2.11` and `16.3.1`) in the same week. Merging both would
   have registered a downgrade on the second.
2. **Are merged blind.** A bot PR only proves the package installs; it
   never proves the app still builds, tests, and lints with the new
   version. Major-version bumps especially need a real gate.
3. **Land without a changelog.** There is no record of what changed, why,
   or what was deliberately deferred.

Independently, the toolchain upgrade path hit a wall: TypeScript shipped
the 7.x line as a native (Go-based) compiler, but `typescript-eslint@8.67.0`
and the `@typescript-eslint/*@8.67.0` packages declare a peer range of
`>=4.8.4 <6.1.0`. Installing TypeScript 7.0.2 caused `npm run lint` to fail
hard with `typescript-eslint does not support TS 7.0`, while `tsc --noEmit`
passed. A lint-broken toolchain is not shippable.

## Decision

1. **Dependency bumps are consolidated into a single release, never merged
   one PR at a time.** The process is captured as the `/consolidate-deps`
   skill in `.claude/skills/consolidate-deps/SKILL.md`. In short:
   - Merge every viable bump onto one `release/deps-update` branch in
     dependency-graph order (patches first, majors last).
   - Resolve cross-PR conflicts with **newest version wins** — never merge
     a downgrade. A PR proposing an older version of a package already
     bumped newer elsewhere is **superseded**, not merged.
   - Gate majors on the real toolchain: `npm run build` + `npm test` +
     `npm run lint` must all pass. A green build alone is not enough.
   - Open a single PR with a grouped changelog (runtime vs dev deps, exact
     version tags), a deferred-and-why section, and a verification matrix.
   - Close every replaced Dependabot PR as superseded with a pointer to the
     consolidated PR and a specific reason per PR.
2. **TypeScript is pinned to 5.x until the lint toolchain supports 7.x.**
   The deferral is explicit (`package.json` keeps `"typescript": "^5"`) and
   leaves a reminder in `CLAUDE.md` so future sessions do not re-bump to 7.x
   and blindly break lint. Re-enable when `typescript-eslint` widens its
   peer range to include 7.x.
3. **Local-only developer docs are kept out of the public repo.** The
   agent-instruction files (`CLAUDE.md`, `AGENTS.md`) and throwaway debug
   artifacts (`.playwright-mcp/`) are not source and not public. They are
   gitignored and untracked; durable knowledge from them lives in this ADR
   and its siblings.

## Consequences

- Dependency history on this repo is one atomic change per consolidation
  instead of N-concurrent PRs. Rollback is one squash-merge revert.
- The two majors actually encountered (pdf-parse 1.x→2.x on the RAG PDF
  extraction path, React 19.2.x) were verified against the real build and
  test suite before landing. pdf-parse 2.x passed and remains; TypeScript
  7.x failed lint and was deferred.
- `npm run lint` remains green on the pinned TS 5.x toolchain. Revisiting
  TS 7 requires widening the `typescript-eslint` peer range first.

## Implementation status

Accepted and applied on 2026-08-19. The `release/deps-update` branch was
merged to `main` as PR #10 with eight bumps: next 16.2.10→16.3.1, react
19.2.4→19.2.8, @types/react 19.2.17→19.2.18, pdf-parse
^1.1.1→^2.4.5, shiki ^4.3.1→^4.4.3, nanoid 3.3.15→3.3.18, postcss
8.5.16→8.5.23, @tailwindcss/postcss 4.3.2→4.3.3, js-yaml 4.3.0→4.3.1.
Nine individual Dependabot PRs were closed as superseded.

## Next steps

- Re-evaluate the TypeScript 7.x deferral after each `typescript-eslint`
  release; the re-enable condition is the peer range including 7.x.
- Run the `/consolidate-deps` skill on future dependabot clusters instead
  of merging individual PRs.