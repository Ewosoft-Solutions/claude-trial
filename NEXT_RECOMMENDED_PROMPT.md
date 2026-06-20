# Next Recommended Prompt

> Kick off the next session by saying **"Read NEXT_RECOMMENDED_PROMPT.md"**. This file is the
> single hand-off prompt; it is kept in sync at the end of each session.
> `AI_HANDOFF.md` holds the full status / history this summarizes.

Phase 2 in progress: nav model wired to a real `ViewerContext` driven by a
server `getSession()` seam + the Next router; `/overview` dashboard live; real
product surfaces built on the M6 layouts + shared data-display (`StatusBadge` /
`ScheduleGrid` / `Meter`) — the full Students area, Attendance
(`/attendance/daily`), the Classes area (timetable · subjects · gradebook), the
Finance area (invoices · payments · reports), the Settings area, and now the
**Reports** area (`/reports/academic` · `/reports/analytics`). Every M6 layout
pattern is exercised in-app, and the `[...slug]` placeholder no longer backs any
shipped section. See the Phase 2 session summaries in `AI_HANDOFF.md`.

Latest session (2026-06-20 pt.2 — chart-wrapper tests + DonutChart 2nd surface + StatGrid tests):
**(1)** Tested the last untested `packages/ui` family, the recharts chart
wrappers. Added a shared jsdom stub `packages/ui/src/test/recharts-mock.tsx`
(`withFixedResponsiveContainer` swaps recharts' `ResponsiveContainer` — which
measures via `ResizeObserver`, absent in jsdom — for a fixed 800×400 passthrough);
each chart test applies it via `vi.mock('recharts', …)`. New suites:
`donut-chart.test.tsx` (5), `trend-chart.test.tsx` (6), `category-bar-chart.test.tsx`
(5). **(2)** Gave `DonutChart` a **second** consumer: `/reports/analytics` now
shows an enrolment-by-level split; the page bottom was restructured (funnel
full-width, then a 2-col row of donut + capacity `Meter`). **(3)** Added
`custom/layouts/stat-grid.test.tsx` (8 — tile count, `minTileWidth`, div/link/button
render modes + `onSelect` click, `hint`, delta tone by intent + by direction).
UI now **72 tests** / 8 files. Verified: UI 72/72 ✅ (Node 22) · `packages/ui`
`tsc -p` ✅ · web check-types ✅ · web lint ✅ · web 13/13 ✅ (Node 20.18) · web build ✅.

> ⚠ The jsdom (component) suite requires **Node ≥20.19** — the same threshold the
> repo `engines` + the `@workspace/database` build already need. Run UI tests
> under `nvm` v22; the resolver + web suites still pass on the default 20.18.

Prior session (2026-06-20 pt.1 — lint fix + DonutChart 1st consumer + ScheduleGrid tests):
cleared the pre-existing `web` lint failure (raw `<a>` → next/link `<Link>` in
`app/design-system/*`), gave `DonutChart` its first consumer (fee-status split on
`/finance/reports`), and added `schedule-grid.test.tsx` (9 cases). See
`AI_HANDOFF.md`.

Earlier session (2026-06-18 — Nav resolver tests): finished wiring the shared
runner (`@workspace/vitest-config` had an empty `src`) and added the first suite
— `packages/ui/src/lib/navigation.test.ts`, **26 cases** over `canAccess` /
`isRouteActive` / `resolveNavigation` / `findActiveNavItem`. The Reports session
before it built the chart wrappers (`TrendChart` / `CategoryBarChart`); see
`AI_HANDOFF.md`.

**Git state:** branch `claude` is on `origin`
(`https://github.com/Ewosoft-Solutions/claude-trial.git`, HTTPS). The accumulated
Phase 2 work (the nav-test / component-test / DonutChart batch, the pt.1 lint fix
+ `/finance/reports` consumer + `schedule-grid.test.tsx`, and this pt.2 work) is
now **committed locally on `claude` in logical splits but not yet pushed** —
`git status` / `git log origin/claude..claude` first. No PR from `claude` →
`main` is open yet (deferred by choice).

Read first:

- AI_CONTEXT.md · AI_HANDOFF.md · CURRENT_PHASE.md (Phase 2)
- implementation-roadmap.md + requirements/ docs for the target area
- packages/ui/README.md (how to consume the foundation + Known Gaps)

Natural next Phase 2 tasks (pick one):

- **More test coverage** now that all `packages/ui` component families are
  exercised. Best remaining targets: **page-level resolution in `apps/web`** (a
  rendered page resolving its nav / viewer state — patterns: `navigation.test.ts`,
  `app-navigation.test.tsx`), or the remaining shell/layout components
  (`PageHeader`, `AppShell`, `SettingsLayout`, `DashboardLayout`). For any recharts
  surface, reuse the jsdom stub `packages/ui/src/test/recharts-mock.tsx`.
- Replace the mock `getSession()` (`apps/web/lib/session.ts`) with a real auth
  source **once the auth flow lands** (still blocked — verified 2026-06-20: no auth
  backend / endpoint exists; `packages/api` is a NestJS service lib with no
  `@Controller`, no `next-auth`, and no login page in `apps/web`). The seam is
  ready: only the function body changes.
- **Open the `claude` → `main` PR** if the accumulated Phase 2 work is ready to
  land (several sessions are now committed on `claude`; no PR is open yet).

Requirements:

- Reuse `packages/ui` components; build new shared UI in `packages/ui` first.
- Pass type-check, lint, and build before considering complete.
- Update `AI_HANDOFF.md` when done, and refresh this `NEXT_RECOMMENDED_PROMPT.md`.

Note: the preview launcher is blocked by macOS TCC (see Known Issues). The
default `web` launch config serves a self-contained build from `/tmp` on **port
3013**; after editing source, rebuild + re-copy to `/tmp` and restart
`preview_start web` (steps in Known Issues), or grant Documents access and use
`web-pnpm`. Infra caveats that persist and are NOT from this work:
`pnpm --filter @workspace/ui lint` fails on a stale `eslint` symlink
(`eslint@9.39.1` linked but `9.39.4` installed — UI source is covered by `tsc`);
and `pnpm build` (turbo, whole repo) fails on `@workspace/database` (Prisma
`ERR_REQUIRE_ESM` under Node 20.18 < required 20.19) — build `apps/web` directly
instead. **Run tests under Node ≥20.19** (e.g. `nvm` v22): the `@workspace/ui`
jsdom suite needs it (so does the repo `engines`); the one `apps/api` Jest
failure (`permission.service.spec.ts`) is pre-existing and unrelated.
