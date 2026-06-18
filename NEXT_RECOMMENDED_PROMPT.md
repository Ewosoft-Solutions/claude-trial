# Next Recommended Prompt

> Kick off the next session by saying **"Read NEXT_RECOMMENDED_PROMPT.md"**. This file is the
> single hand-off prompt; it is kept in sync at the end of each session.
> `AI_HANDOFF.md` holds the full status / history this summarizes.

Phase 2 in progress: nav model wired to a real `ViewerContext` + the Next
router; `/overview` dashboard live; real product surfaces built on the M6
layouts + shared data-display (`StatusBadge` / `ScheduleGrid` / `Meter`) — the
full Students area (directory · enrollment · attendance history · fees ·
transport · gradebook report-cards + transcripts), Attendance
(`/attendance/daily`), the Classes area (timetable · subjects · gradebook), the
Finance area (invoices · payments · reports), and the Settings area
(general/branding/features/roles/users/audit on the M6 `SettingsLayout`) — see
the Phase 2 session summaries in `AI_HANDOFF.md`. Every M6 layout pattern is
exercised in-app.

**Git state:** branch `claude` is on `origin`
(`https://github.com/Ewosoft-Solutions/claude-trial.git`, HTTPS — no SSH
blocker). The Students sub-pages + these doc updates may be uncommitted in the
working tree — `git status` first, then commit + push. No PR from `claude` →
`main` is open yet (deferred by choice).

Read first:

- AI_CONTEXT.md · AI_HANDOFF.md · CURRENT_PHASE.md (Phase 2)
- implementation-roadmap.md + requirements/ docs for the target area
- packages/ui/README.md (how to consume the foundation + Known Gaps)

Natural next Phase 2 tasks (pick one):

- Build the last placeholder section — **Reports** (`/reports/academic`,
  `/reports/analytics`): a good chance to use the `chart` primitive
  (`packages/ui/components/chart.tsx`, recharts) alongside `StatGrid` + `Meter`
  for a more analytics-flavoured surface. (`/reports` would redirect to one.)
- Tidy-up: the app-shell secondary nav duplicates the in-panel `SettingsNav` —
  consider emptying the Settings section groups in `app-navigation.tsx` (see the
  Settings session's design note).
- Replace the **mock session** (`app/providers/viewer-provider.tsx`) with a real
  auth source when the auth flow lands.
- Add unit tests for `resolveNavigation` / `canAccess` / `isRouteActive` /
  `findActiveNavItem` (still only cross-checked manually).

Requirements:

- Reuse `packages/ui` components; build new shared UI in `packages/ui` first.
- Pass type-check, lint, and build before considering complete.
- Update `AI_HANDOFF.md` when done, and refresh this `NEXT_RECOMMENDED_PROMPT.md`.

Note: the preview launcher is blocked by macOS TCC (see Known Issues). The
default `web` launch config serves a self-contained build from `/tmp`; after
editing source, rebuild + re-copy to `/tmp` and restart `preview_start web`
(steps in Known Issues), or grant Documents access and use `web-pnpm`.
