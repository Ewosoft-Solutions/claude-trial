<!-- Prepend this to the TOP of /AI_HANDOFF.md (below the title). Newest first. Never rewrite history. -->

## Session Summary (<YYYY-MM-DD>[, pt. N]) — <agent>: <one-line what changed>

**Item(s):** <ID(s)> → <new board status>. **Branch/PR:** <branch> / <PR link>.

**What changed & why**

- <bullet: the change, tied to the job / decision — not a diff dump.>

**Verification** (what was actually run + result)

- `pnpm ci:quick` — <pass/fail + notable output>
- <domain gate, e.g. `pnpm db:rls:check` — green; `pnpm db:verify` — 305 perms OK>
- <live/browser check if UI, with what was observed>

**Decisions / ADRs**

- <ADR-NN accepted / proposed, or "none">

**Next step (so the next agent can resume)**

- <the single most useful next action; board note mirrors this.>

**New gotcha (if any)** → also add to `/AGENTS.md` §7 if durable.
