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

Latest session (2026-06-18 — Nav resolver tests): stood up the first web/UI
test suite and finished wiring the shared runner. **`@workspace/vitest-config`**
had an empty `src` (its `dist/configs/*` exports resolved to nothing *and* it
aborted `turbo run build`); populated it with a buildable shared config —
`configs/base-config.ts` (`baseConfig`, node env) + `configs/ui-config.ts`
(`uiConfig`, jsdom) via `index.ts` (NodeNext → `.js` imports) — and deleted the
stale root `base.ts`. `packages/ui` now consumes `baseConfig`
(`vitest.config.ts` + `test` script) and has **26 unit tests** in
`src/lib/navigation.test.ts` covering `canAccess` / `isRouteActive` /
`resolveNavigation` / `findActiveNavItem`. ui test 26/26 ✅ · web check-types ✅ ·
web lint ✅ · web build ✅ · `packages/ui` `tsc -p` ✅. The repo-wide build no
longer aborts on vitest-config (it now fails further along on a pre-existing,
unrelated `@workspace/database` Prisma `ERR_REQUIRE_ESM` / Node-version issue).

Prior session (2026-06-18 — Reports): built the last placeholder section on
**new reusable chart wrappers in `packages/ui`** (built there first, per the
rules, so recharts stays out of `apps/web`):
`types/chart.types.ts` (`ChartDatum` / `ChartSeries`), `custom/charts/trend-chart.tsx`
(`TrendChart` — area/line) and `custom/charts/category-bar-chart.tsx`
(`CategoryBarChart` — grouped/stacked, column/bar). Two recharts gotchas were
fixed + documented (README → Charts): axis children must be **direct** (recharts
ignores fragment-wrapped axes), and marks set `isAnimationActive={false}`.

**Git state:** branch `claude` is on `origin`
(`https://github.com/Ewosoft-Solutions/claude-trial.git`, HTTPS). The Reports
work and the nav-test/runner work are committed **and pushed**; only this set of
doc updates (`AI_HANDOFF.md`, this file) may be uncommitted at hand-off —
`git status` first. No PR from `claude` → `main` is open yet (deferred by
choice).

Read first:

- AI_CONTEXT.md · AI_HANDOFF.md · CURRENT_PHASE.md (Phase 2)
- implementation-roadmap.md + requirements/ docs for the target area
- packages/ui/README.md (how to consume the foundation + Known Gaps)

Natural next Phase 2 tasks (pick one):

- **Extend test coverage** now that the runner is wired. Highest-value next
  targets: the `app-navigation` config (`apps/web/lib/navigation/app-navigation.tsx`)
  resolving correctly for representative viewers, and the first **component**
  tests — switch a `packages/ui` `vitest.config.ts` to `uiConfig` (jsdom is
  already a vitest-config devDep) and render a shared component (e.g.
  `StatusBadge` / `Meter`). Pattern to copy: `packages/ui/src/lib/navigation.test.ts`.
- Replace the mock `getSession()` (`apps/web/lib/session.ts`) with a real auth
  source **once the auth flow lands** (currently blocked — no auth backend /
  endpoint exists; `packages/api` is a NestJS lib with no auth endpoint). The
  seam is ready: only the function body changes.
- Polish / extend the chart wrappers if a future surface needs it (e.g. a
  time-range toggle like `custom/charts/chart-area-interactive`, or a donut /
  radial variant). Not required by any current surface.

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
(`eslint@9.39.1` linked but `9.39.4` installed — UI source is covered by `tsc` +
the `web` lint); and `pnpm build` (turbo, whole repo) now clears
`@workspace/vitest-config` (its `src` was populated this session) but still fails
further along on `@workspace/database` (Prisma `ERR_REQUIRE_ESM` under Node
20.18 < required 20.19) — build `apps/web` directly instead. `pnpm test` (turbo)
runs `@workspace/ui` green; the one `apps/api` Jest failure
(`permission.service.spec.ts`) is pre-existing and unrelated.
