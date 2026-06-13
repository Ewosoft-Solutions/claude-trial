# AI_HANDOFF.md

Last Updated: 2026-06-13

---

# Current Status

Current Phase:

Phase 1 - Design System Foundation

Completion:

~57% (Milestones 1–4 of 7 complete: Web Preview Scaffold, Token Foundation,
Core Shell Components, Role-Aware Navigation Model)

---

# Completed Work

## Session Summary (2026-06-13) — Milestone 4: Role-Aware Navigation Model

Added a typed, declarative navigation model that drives the M3 shell, filtered
by the same role / clearance / permission vocabulary the backend will authorize
against (requirements/access-control.md + permissions.md). The shell components
are unchanged in contract — they still consume `RailItem[]` / `NavGroup[]` and
carry no roles, permissions, or tenant logic. Built on the
`chore/technical-debt-cleanup` branch (M4 changes are currently uncommitted —
see Known Issues for the git-state note).

New model (in `packages/ui`, framework-agnostic, no React/side effects):

- **`types/access.types.ts`** — RBAC primitives: `ClearanceLevel` (0–10),
  `StandardRole`, `RoleKey` (standard + custom), `SchoolType` (polymorphic),
  `NavScope` (`platform` | `school`), `PermissionKey`, `ViewerContext` (the
  signed-in viewer), and `NavAccess` (a node's guard: `minClearance`, `scope`,
  `roles`, `schoolTypes`, `anyPermission`, `allPermissions` — AND across fields).
- **`types/navigation.types.ts`** — declarative config: `NavNode`,
  `NavGroupNode`, `NavSectionNode` (a rail destination + its secondary panel),
  `NavigationConfig` (sections + footer), and `ResolvedNavigation` (shell-ready
  output). Nodes carry an `href` (route) and `access` guard, never an `active`
  flag.
- **`lib/navigation.ts`** — pure resolver: `canAccess` (guard eval),
  `isRouteActive` (exact / ancestor match), `CLEARANCE_BY_ROLE`, and
  `resolveNavigation(config, viewer, currentPath, { onNavigate? })`. Drops nodes
  the viewer can't access, collapses empty groups / panels, and marks exactly
  one active leaf (most-specific route wins) plus its owning section. With
  `onNavigate` the items dispatch via `onSelect` (controlled routing, used by the
  preview); without it they carry `href` (plain links).

Preview (`apps/web/app/design-system/shell/`):

- **`navigation.data.tsx`** (preview-only) — example `SCHOOL_NAV` and
  `PLATFORM_NAV` configs with realistic access guards, plus four viewer personas
  (Registrar, Teacher, Owner @ school; Architect @ platform).
- **`page.tsx`** — rewired to resolve the sidebar from the model. Hardcoded
  `active: true` flags are gone; active state derives from a simulated in-page
  route (selecting any destination updates it). Added a **persona switcher**
  (shared `Select`) so reviewers can watch role/clearance/permission/scope
  filtering live; selecting a platform persona swaps the whole surface to
  `PLATFORM_NAV`. Page title, breadcrumbs, and panel header derive from the
  active route / tenant.

Also fixed a latent M3 bug surfaced by wiring `onSelect` onto rail items: in
`AppSidebar`'s `NavElement`, the Radix Tooltip (`asChild`) injects its own
`onClick`, which clobbered `onSelect` due to spread order — rail clicks silently
did nothing. `NavElement` now composes both handlers.

### Verification (Milestone 4)

- `pnpm --filter web check-types` ✅ · `lint` ✅ · `build` ✅ (6/6 static).
- Live preview: Registrar sees Overview/Students/Classes/Attendance/Reports
  (Finance correctly hidden — clearance 4 < 5); Architect flips to the platform
  rail (Tenants/Analytics/Audit/Support/Billing); rail + secondary-nav clicks
  move active state along the route; mobile (375) collapses to the bottom tab
  bar with the active tab tracking the route; light + dark verified.
- Resolver cross-checked against the real configs via a throwaway `tsx` harness
  for Teacher / Owner / Architect routes (group-emptying, permission filtering,
  and deepest-match active all correct).

## Session Summary (2026-06-13) — Technical Debt Cleanup (TD-001, TD-003, TD-004)

Maintenance pass (not a milestone) resolving three of the four tracked debt
items. Committed on branch `chore/technical-debt-cleanup` (not yet
merged/pushed). See `TECHNICAL_DEBT.md` for the per-item record.

- **TD-001 (resolved)** — deleted the superseded legacy shadcn template
  components that still embedded sample data: `app-sidebar.tsx`, `nav-main.tsx`,
  `nav-projects.tsx`, `nav-user.tsx`, `team-switcher.tsx`, plus the now-orphaned
  `sidebar-toggle.tsx` (it was imported only by the legacy `app-sidebar`). None
  were imported by `apps/web`. The data-driven shell set under
  `packages/ui/src/custom/shell/` is unaffected.
- **TD-003 (resolved)** — removed the hardcoded debug styling
  (`text-primary bg-destructive`) from the `ModeToggle` trigger so it uses the
  standard `outline` button variant. Verified in the `/design-system` preview:
  neutral `bg-background` trigger, no console errors.
- **TD-004 (resolved)** — deleted the dead `pnpm.overrides` field from root
  `package.json` (pnpm 10 ignored it and warned each install). The five legacy
  overrides were deliberately **not** migrated to `pnpm-workspace.yaml`:
  `glob`/`rimraf` were stale upward pins that would now *downgrade* the newer
  resolved versions (`glob@13`, `rimraf@6`); `lodash.get` and `@types/minimatch`
  are absent from the dependency graph; and the `inflight` swap was left out to
  keep the change resolution-neutral (available as an optional follow-up).

Only **TD-002** (notification service — an unbuilt feature, not cleanup) remains
pending.

### Verification (Technical Debt Cleanup)

- `pnpm install` ✅ no `pnpm` field warning; dependency resolution unchanged.
- Visual via preview: `/design-system` mode-toggle trigger confirmed neutral
  (no red), no console errors.
- Note: the committed `pnpm-lock.yaml` is still on legacy `lockfileVersion 5.4`
  (pnpm 6 era) while the repo uses pnpm 10.4.1; a `pnpm install` regenerates it
  to `9.0`. That lockfile regeneration was intentionally *not* bundled into this
  commit and remains a separate cleanup (see Known Issues).

## Session Summary (2026-06-13) — Milestone 3: Core Shell Components

Productized the Aurora Layout A application shell as typed, data-driven
components in `packages/ui/src/custom/shell/`, translating the
`design-export` references (`shell-base.css`, `shell-build.js`,
`aurora-responsive.css`) onto the Milestone 2 token layer. No component embeds
sample/template data — all sample content lives in the new
`/design-system/shell` preview (resolves the original TD-001 requirement; see
TD-001 for the remaining legacy-component cleanup).

Components delivered (all light/dark aware, layout-stable, token-driven):

- **AppShell** (`app-shell.tsx`) — the chrome frame (header · rail · nav ·
  main · inspector · status bar). Pure slot-based layout. Consumes the
  layout-dimension tokens (`--header-height`, `--rail-width`, `--nav-width`,
  `--inspector-width`, `--content-padding`) and colour roles; no hardcoded
  dimensions. Also exports `ShellMain` (padded scroll region).
- **AppHeader** (`app-header.tsx`) — top bar with slots for the school
  switcher, breadcrumbs, center search, and actions. Exports `OmniSearch`
  (the ⌘K command affordance).
- **AppSidebar** (`app-sidebar.tsx`) — icon rail (md+), secondary nav panel
  with groups / items / one level of sub-items / badges / footer slot (lg+),
  and a bottom **mobile tab bar** (<md) for the mobile-navigation behavior.
  Driven by `RailItem[]` / `NavGroup[]`.
- **SchoolSwitcher** (`school-switcher.tsx`) — tenant chip + switch menu
  (`SchoolOption[]`), optional "add school" affordance.
- **UserMenu** (`user-menu.tsx`) — avatar trigger + account dropdown
  (`UserProfile` + `UserMenuItem[]`), reuses the shared Avatar.
- **AppBreadcrumbs** (`app-breadcrumbs.tsx`) — typed `BreadcrumbEntry[]`,
  wraps the shared breadcrumb primitive.
- **PageHeader** (`page-header.tsx`) — title + meta sub-line + actions slot;
  exports `SegmentedControl` (the Pipeline/List/Calendar control).

Shared contracts live in `packages/ui/src/types/shell.types.ts` (SchoolOption,
RailItem, NavItem, NavGroup, UserProfile, UserMenuItem, BreadcrumbEntry,
PageHeaderMeta). Existing primitives reused where they fit (Button, Badge,
Card, Avatar, Breadcrumb, DropdownMenu, Tooltip) — no one-off UI.

Responsive model is CSS-only (Tailwind viewport breakpoints — SSR-safe, no
layout shift): <md collapses the rail to a bottom tab bar and hides the
secondary nav / inspector / status bar; lg+ shows rail + nav; xl+ shows the
inspector.

### Verification (Milestone 3)

- `pnpm --filter web check-types` ✅
- `pnpm --filter web lint` ✅
- `pnpm --filter web build` ✅ (`/design-system` + `/design-system/shell`
  prerendered static)
- Visual via preview: `/design-system/shell` confirmed faithful to the Aurora
  design in **dark + light** at desktop (1440) and **mobile** (375) — top bar,
  rail, secondary nav, page header, inspector, status bar on desktop; condensed
  top bar + bottom tab bar with nav/inspector/status hidden on mobile. School
  switcher dropdown verified opening with all tenants + "Add school".
- Note: `pnpm --filter @workspace/ui lint` fails to resolve `eslint` (the
  package has no direct eslint dep) — pre-existing infra, unrelated to this
  change; shell source is still covered by `tsc` and the web lint. Logged as a
  follow-up below.

## Session Summary (2026-06-13) — Milestone 2: Token Foundation

Translated the approved `design-export` **Aurora** direction (neon-glass,
light + dark) into a stable, flat token layer in
`packages/ui/src/styles/globals.css`. Aurora light maps to `:root`, Aurora
dark to `.dark`.

- Replaced the neutral starter palette with Aurora color roles for both
  themes: base surfaces, primary (`#4f6df5` light / `#5b8cff` dark),
  secondary/muted, accent, destructive, border/input/ring, and full sidebar
  roles. Light/dark parity verified.
- Added semantic status tokens — `--success`, `--warning`, `--info` (+
  `-foreground`) — sourced from Aurora `--pos` / `--warn` / `--accent-2`, and
  registered them in `@theme inline` (usable as `bg-success`, etc.).
- Mapped the chart palette (`--chart-1..5`) to the Aurora neon blend
  (blue · green · blurple · pink · amber) for each theme.
- Added structural tokens (theme-independent): radius base `1rem` (Aurora
  rounded), typography (font-family roles wired to the app's `next/font`
  Geist variables with Aurora families as fallback, plus weight / leading /
  tracking scales), layout dimensions (rail/nav/inspector widths, content
  padding, header height), and an elevation scale (`--shadow-xs..lg`,
  `--shadow-card`, `--shadow-accent`) with dark overrides.
- Removed the leftover starter `--foreground-rgb` variables and the gradient
  `body` background (resolves the Known Issue from Milestone 1). `body` now
  uses `bg-background text-foreground font-sans` only.
- Documented the **tenant branding contract**: tenants may override brandable
  color roles only (scoped to a `data-tenant` attribute), never structural
  tokens (radius, fonts, layout dimensions, spacing, elevation). Includes a
  worked light + dark example in the file.
- Dropped the dead `--mode-toggle-background/foreground` vars (nothing
  consumed them; `ModeToggle` styling is hardcoded — see TD-003).

## Verification

- `pnpm --filter web check-types` ✅
- `pnpm --filter web lint` ✅
- `pnpm --filter web build` ✅ (`/design-system` prerendered static)
- Visual: `/design-system` previewed in light + dark at desktop (1280) and
  mobile (375) viewports. Confirmed token values resolve per theme
  (`--background`, `--primary`, `--success/--warning/--info`, `--radius`,
  `--shadow-card`), `body` font resolves to Geist, and the legacy
  `--foreground-rgb` is gone.

## Session Summary (2026-06-13) — Milestone 1

Rebuilt `apps/web` as the design-system preview surface (the prior scaffold had
been removed from the working tree). This satisfies Phase 1 / Milestone 1
("Web Preview Scaffold") in `implementation-roadmap.md`.

- Scaffolded a minimal Next.js 15 app in `apps/web`, wired to `@workspace/ui`,
  shared Tailwind/PostCSS config, workspace TypeScript config, and ESLint.
- Imports `@workspace/ui/globals.css` (the existing shared token layer) and
  mounts `ThemeProvider` + `ColorScheme` so light/dark theming works.
- Switched fonts from the deleted local `.woff` files to `next/font/google`
  Geist / Geist Mono (no binary assets committed).
- Added a `/design-system` preview route rendering shared `@workspace/ui`
  components (Button, Badge, Card, Input, Label) plus the shared `ModeToggle`
  for theme switching. `/` redirects to `/design-system`.
- Resolved a workspace-wide `@types/react` duplication (Radix pulled 19.1.0 vs
  app 19.2.17), which made forwardRef components fail as JSX element types, by
  adding an `overrides` block to `pnpm-workspace.yaml`.

## Verification

- `pnpm --filter web check-types` ✅
- `pnpm --filter web lint` ✅
- `pnpm --filter web build` ✅ (`/design-system` prerendered static)
- Runtime smoke test: `/` serves, `/design-system` returns 200 and renders.

---

# Files Modified

## Milestone 4 (Role-Aware Navigation Model) — uncommitted on chore/technical-debt-cleanup

Created:

- packages/ui/src/types/access.types.ts (RBAC primitives)
- packages/ui/src/types/navigation.types.ts (navigation config + resolved shapes)
- packages/ui/src/lib/navigation.ts (canAccess / isRouteActive / resolveNavigation)
- apps/web/app/design-system/shell/navigation.data.tsx (example configs + personas)

Edited:

- packages/ui/src/custom/shell/app-sidebar.tsx (NavElement: compose injected
  onClick with onSelect — fixes rail items being inert)
- apps/web/app/design-system/shell/page.tsx (resolve sidebar from the model;
  remove hardcoded active flags; add persona switcher)
- AI_HANDOFF.md (this file)

No changes to the Prisma schema or any API. The model is pure TypeScript; the
shell component contracts (`RailItem[]` / `NavGroup[]`) are unchanged.

## Technical Debt Cleanup (TD-001, TD-003, TD-004) — branch chore/technical-debt-cleanup

Deleted:

- packages/ui/src/custom/app-sidebar.tsx (legacy template)
- packages/ui/src/custom/nav-main.tsx (legacy template)
- packages/ui/src/custom/nav-projects.tsx (legacy template)
- packages/ui/src/custom/nav-user.tsx (legacy template)
- packages/ui/src/custom/team-switcher.tsx (legacy template)
- packages/ui/src/custom/sidebar-toggle.tsx (orphaned by the above)

Edited:

- packages/ui/src/custom/mode-toggle.tsx (removed debug styling)
- package.json (removed dead `pnpm.overrides` field)
- TECHNICAL_DEBT.md (TD-001/003/004 moved to Resolved; TD-002 still pending)
- AI_HANDOFF.md (this file)

No changes to the Prisma schema or any API. The `pnpm-workspace.yaml` React-type
overrides are pre-existing uncommitted work and were left untouched.

## Milestone 3 (Core Shell Components)

Created:

- packages/ui/src/types/shell.types.ts (shell contracts)
- packages/ui/src/custom/shell/app-shell.tsx (AppShell + ShellMain)
- packages/ui/src/custom/shell/app-header.tsx (AppHeader + OmniSearch)
- packages/ui/src/custom/shell/app-sidebar.tsx (rail + nav + mobile tab bar)
- packages/ui/src/custom/shell/school-switcher.tsx
- packages/ui/src/custom/shell/user-menu.tsx
- packages/ui/src/custom/shell/app-breadcrumbs.tsx
- packages/ui/src/custom/shell/page-header.tsx (PageHeader + SegmentedControl)
- apps/web/app/design-system/shell/page.tsx (full-bleed shell preview;
  holds all sample data)

Edited:

- apps/web/app/design-system/page.tsx (added "View app shell" link)
- TECHNICAL_DEBT.md (updated TD-001 status)
- AI_HANDOFF.md (this file)

No changes to existing `packages/ui` components, the Prisma schema, or any API.
Shell components only consume existing primitives and the Milestone 2 tokens.

## Milestone 2 (Token Foundation)

Edited:

- packages/ui/src/styles/globals.css (Aurora token layer; removed legacy
  starter variables + gradient body)
- AI_HANDOFF.md (this file)

Created:

- .claude/launch.json (preview dev-server config for the `/design-system`
  verification route)

No changes to `packages/ui` components, the Prisma schema, or any API.

## Milestone 1 (Web Preview Scaffold)

Created:

- apps/web/package.json
- apps/web/next.config.ts
- apps/web/tsconfig.json
- apps/web/postcss.config.js
- apps/web/eslint.config.mjs
- apps/web/components.json
- apps/web/.gitignore
- apps/web/lib/utils.ts
- apps/web/app/layout.tsx
- apps/web/app/page.tsx
- apps/web/app/providers/theme-provider.tsx
- apps/web/app/design-system/page.tsx

Edited:

- pnpm-workspace.yaml (added React type `overrides`)
- TECHNICAL_DEBT.md (added TD-003, TD-004)
- AI_HANDOFF.md (this file)

No changes to `packages/ui`, the Prisma schema, or any API.

---

# Architectural Decisions

Decision:

`apps/web` is a design-system preview surface only for Phase 1, not a product
app. `/` redirects to `/design-system`.

Reason:

Roadmap scopes `apps/web` to validating shared UI before product workflows
begin; keeps the foundation stable before screens are built on it.

---

Decision:

Pin a single `@types/react` / `@types/react-dom` across the workspace via
`pnpm-workspace.yaml` overrides.

Reason:

Transitive deps (Radix) pulled an older `@types/react`; multiple copies break
forwardRef components as JSX element types. A single version is required for the
shared UI to type-check from `apps/web`.

---

# Outstanding Tasks (Phase 1)

High Priority

- Milestone 5: State components (loading, skeletons, empty, error, forbidden,
  offline/read-only, validation summary). The navigation model already exposes a
  `forbidden`-style concept via access filtering; M5 adds the page/section states
  themselves.

Medium Priority

- Milestone 6: Layout patterns (dashboard, list/detail, table, form, settings).
  The shell preview's main body is a placeholder for these.
- Wire the M4 navigation model to real auth/session + the Next router once
  product screens exist (replace the simulated in-page route and persona switcher
  with `usePathname` + the real `ViewerContext`). Likely Phase 2.

Low Priority

- Milestone 7: Design-system usage docs + accessibility/responsive notes.
- Cleanup: fix the `@workspace/ui` lint script's missing eslint dep. (The
  legacy shadcn template component removal — formerly TD-001 — is done.)

---

# Known Issues

- Git state: most of the project (shell, `/design-system`, requirements, this
  doc's siblings) is still **uncommitted/untracked** in the working tree; `main`
  holds the old template. Only the TD-cleanup touched files were committed, on
  `chore/technical-debt-cleanup`. The Milestone 4 changes sit **uncommitted on
  that same branch** (stacked on the cleanup). Before any push, decide how to
  carve these into commits/branches — they are currently intermingled in the
  working tree.
- TD-002: notification service not implemented. Unbuilt feature (not cleanup);
  remains the only pending item in TECHNICAL_DEBT.md.
- TD-001, TD-003, TD-004: resolved this session (branch
  `chore/technical-debt-cleanup`, not yet merged). See the cleanup session
  summary above and TECHNICAL_DEBT.md.
- Stale lockfile: committed `pnpm-lock.yaml` is `lockfileVersion 5.4` (pnpm 6
  era) while the repo uses pnpm 10.4.1; any `pnpm install` regenerates it to
  `9.0`. Regenerating/committing it is a deferred, separate cleanup.
- `pnpm --filter @workspace/ui lint` fails to resolve `eslint` (package has no
  direct eslint dependency). Pre-existing infra; shell source is covered by
  `tsc` + the `web` lint. Tracked under the Milestone 7 cleanup item.
- Aurora's glassmorphic surfaces remain flattened to solid colour roles in the
  token layer (Milestone 2 decision). The shell renders against those flat
  roles; the decorative aurora gradient field was not reintroduced and is
  considered out of scope (chrome reads cleanly in both themes without it).

---

# Database Impact

No database changes made.

---

# API Impact

No API changes made.

Breaking Changes: None.

---

# Testing Status

TypeScript: ✅ Passed (`pnpm --filter web check-types`)
Lint:       ✅ Passed (`pnpm --filter web lint`)
Build:      ✅ Passed (`pnpm --filter web build`)
Visual:     ✅ `/design-system/shell` verified light + dark, desktop + mobile;
            persona switching + route-derived active state confirmed live
Unit Tests: ⚠ None added (presentational components + pure resolver; resolver
            cross-checked via a throwaway tsx harness — a real unit test for
            `resolveNavigation` is a good Phase-2 follow-up)
E2E:        ⚠ Not applicable yet

---

# Next Recommended Prompt

Read:

- AI_CONTEXT.md
- AI_HANDOFF.md
- CURRENT_PHASE.md
- implementation-roadmap.md (Milestone 5)
- DESIGN_RULES.md
- design-export/ (for any state visuals — loading, empty, error, forbidden)

Then begin Phase 1 / Milestone 5 (State And Feedback Components):

- Build reusable state components so screens never appear blank or undefined:
  loading, skeleton patterns, empty, error, forbidden, offline/read-only, and a
  validation-summary pattern.
- Put them in `packages/ui` (typed props, no embedded copy), and preview them on
  a `/design-system` route. Reuse existing primitives; do not create one-off UI.
- States must support concise titles/actions without layout shift and be
  accessible/keyboard-friendly where actions exist.
- The `forbidden` state should pair naturally with the M4 navigation model
  (access filtering hides nav; `forbidden` covers direct/deep-link access).

Requirements:

- Follow approved designs (design-export) and the access-control requirements
  as source of truth.
- Reuse `packages/ui` components; do not create one-off UI.
- Pass type-check, lint, and build before considering complete.
- Update AI_HANDOFF.md when done.

Note: before pushing, resolve the git-state item under Known Issues (M4 changes
are uncommitted, stacked on `chore/technical-debt-cleanup`).
