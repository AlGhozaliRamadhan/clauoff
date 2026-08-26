# ADR-0009: CLAUDE.md and ADRs as the Project's Source of Truth

## Status: Accepted

## Context

Cogito has been growing without a fixed process for *recording* the
decisions behind the code. `CLAUDE.md` already gives an agent a snapshot
of the codebase, and `docs/adr/0006`–`0008` capture the bigger calls
(web search, tool registry, dependency consolidation). But:

- The exact rules of how to keep both of those in sync are not written
  down. A new agent (or a returning one after a long gap) has to infer
  "do I write an ADR for this change?" from vibes.
- The relationship between `CLAUDE.md` and ADRs is also unclear. Today
  `CLAUDE.md` is the fast-read; ADRs are the deep history. Nothing in
  the repo says which one wins when they disagree.
- The repository and product name are not aligned. The product has been
  branded **Cogito** for a while (`package.json` name, page title, the
  product mark in `globals.css`) but the on-disk directory and a couple
  of internal references still use the working name. That drift is
  noise: future agents grep "Cogito" and miss the working-name hits, and
  users see the wrong name in any path or URL that leaks it.

This ADR sets both rules so the next agent doesn't have to guess, and
codifies the project rename to **Cogito** (the working name on disk
will follow once the GitHub repo is renamed — see Consequences).

## Decision

### 1. The product is Cogito

- The product name is **Cogito**. Always. In user-facing strings, page
  titles, metadata, README, comments, commit messages, and ADRs.
- The on-disk working name is allowed to lag the public name while the
  GitHub repo is being renamed. While the rename is in flight:
  - `clauoff` may appear in **paths only** (directory, repo URL, etc.)
    where changing it requires a remote-side rename.
  - `clauoff` must **not** appear in any user-facing string, page
    metadata, README, or comment. If a grep for `clauoff` in the repo
    returns anything outside `SECURITY.md` (which holds the GitHub
    security advisory URL), it's a bug — fix it.
- The Anthropic sunburst logo is **not** used, recreated, or
  approximated. Cogito uses its own mark.

### 2. `CLAUDE.md` and ADRs are the source of truth

- `CLAUDE.md` is the **always-on entry point**. Every agent session
  reads it. It describes the *current* state of the project: what
  Cogito is, what the tech stack is, the architecture rules that must
  not be violated, and the visual / workflow conventions.
- `docs/adr/NNNN-*.md` is the **decision log**. Each ADR records one
  decision (or one tightly-scoped set of related decisions) with the
  context, the chosen approach, and the consequences. ADRs are
  append-only — never rewrite history, only add new ADRs that supersede.
- When `CLAUDE.md` and an ADR disagree, **trust the code, then sync
  the docs.** The reconciliation rule is the one already in
  `CLAUDE.md` — if reality drifts from the docs, the docs are wrong,
  not the code.

### 3. Agents must consult both before any non-trivial change

Before writing code for any change that is not a trivial fix (typo,
one-line tweak, obvious bug), an agent must:

1. Re-read `CLAUDE.md` end-to-end. The "do not violate" list is a hard
   constraint; if the change conflicts with any of it, the change is
   wrong.
2. Skim the ADRs in `docs/adr/` and read the ones that touch the area
   being changed. A new feature on top of web search, for example, has
   to read ADR-0006 and ADR-0007 first.
3. Decide whether the change is a **major** or a **scoped minor** (see
   the rule below) and act accordingly.

### 4. Write or update an ADR for every non-trivial change

This is the rule that fixes the "do I write an ADR?" guesswork.

- **Major change** — new feature, new module, new external dependency,
  breaking architectural shift, change to a "do not violate" rule,
  anything that meaningfully alters how the project works. Write a
  **new ADR** in `docs/adr/` with the next number. The new ADR can
  supersede an older one if it changes the same area; if it does,
  say so explicitly and link the predecessor.

- **Scoped minor change** — a series of small edits **all in the same
  area, all under one ongoing piece of work** (e.g. a UI pass that
  refactors the sidebar over a few commits; a sequence of agent-tool
  tweaks all sitting on top of the registry in ADR-0007). Append
  these as dated **Change log** entries at the bottom of the **same
  ADR** that originally introduced the area. Do not start a new ADR
  per commit. The split point is: *once the change moves on to a
  different area or different concern, it gets its own ADR.*

- **Pure bug fix or trivial change** — no ADR required. Just commit
  it. (If a bug fix invalidates a "consequences" claim in an ADR, the
  ADR is updated in the same commit so they don't drift.)

- **Every new ADR** must end with an **Implementation status** section
  in the same shape as ADR-0008's: what was actually built, when, and
  (if relevant) the PR / commit pointers.

### 5. `CLAUDE.md` is updated alongside, not instead of, ADRs

- ADRs capture *why* a decision was made at a point in time. They are
  the historical record.
- `CLAUDE.md` captures the *current* state of the project, including
  the consequence of every accepted ADR. When an ADR is accepted,
  `CLAUDE.md` is updated in the same change so the always-on read
  stays accurate.
- Stale claims in `CLAUDE.md` are the bug. The reconciliation step in
  §2 is run on every review.

## Consequences

- Future agents have a written rule for "do I write an ADR?" instead
  of guessing. The scoped-minor rule keeps the ADR count from
  exploding while still preserving the trail.
- Every major change leaves a paper trail in `docs/adr/`. Rolling back
  a decision means reading the ADR that made it, not archeology.
- `CLAUDE.md` becomes reliable as a current-state read because it gets
  updated in lockstep with each accepted ADR.
- The `clauoff` working name is allowed to remain in paths until the
  GitHub repo is renamed. After the rename, the directory and the
  security advisory URL can be updated in one mechanical pass; the
  ADR will be amended to record that.
- A possible downside: the cost of writing an ADR is non-zero, so
  trivial changes must genuinely stay trivial and not get inflated
  into ADR-worthy scope. The "pure bug fix" carve-out is the escape
  hatch.

## Implementation status

Accepted on 2026-08-26. Applied in the same change:

- `CLAUDE.md` rewritten to (a) start with the new always-on entry-point
  contract, (b) state the ADR-on-every-change rule with the
  major-vs-scoped-minor heuristic, (c) keep all the source-of-truth
  claims that were already there (tech stack, backend architecture,
  visual rules, workflow expectations), and (d) drop every reference
  to the working name `clauoff` from prose.
- Repo-wide grep for `clauoff` (case-insensitive) run; the only hit
  outside the always-allowed paths is `SECURITY.md`'s GitHub advisory
  URL, which references the on-disk repo name and is left in place
  pending the repo rename.
- The `create-architectural-decision-record` skill (`/skills`) is the
  recommended way to scaffold any new ADR; this one was hand-written
  to match the existing format of 0006–0008.
