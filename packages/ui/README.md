# @workspace/ui — SchoolWithEase Design System

The shared UI foundation for SchoolWithEase: design tokens, primitive
components, the application shell, a role-aware navigation model, state/feedback
components, and layout patterns. Built in Phase 1 so product screens can be
assembled from shared, typed, themeable building blocks instead of one-off UI.

> **Source of truth.** Approved designs live in `design-export/`; access-control
> vocabulary in `requirements/access-control.md` + `requirements/permissions.md`.
> Do not redesign screens, change the spacing scale, or introduce new colors —
> see `DESIGN_RULES.md`.

---

## 1. Consuming the package

`@workspace/ui` is a source-only workspace package (no build step) consumed by
`apps/web`. Import paths map straight to files under `src/` via the package
`exports` map:

| Import specifier | Resolves to |
| --- | --- |
| `@workspace/ui/globals.css` | `src/styles/globals.css` (the token layer) |
| `@workspace/ui/components/*` | `src/components/*.tsx` (primitives) |
| `@workspace/ui/custom/*` | `src/custom/*.tsx` (incl. nested, e.g. `custom/shell/app-shell`) |
| `@workspace/ui/lib/*` | `src/lib/*.ts` |
| `@workspace/ui/hooks/*` | `src/hooks/*.ts` |
| `@workspace/ui/types/*` | `src/types/*.ts` |

```tsx
import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { DashboardLayout } from '@workspace/ui/custom/layouts/dashboard-layout';
import { cn } from '@workspace/ui/lib/utils';
```

Set up once in the host app:

1. Import the token layer in the root layout: `import '@workspace/ui/globals.css'`.
2. Mount theme support (`next-themes` `ThemeProvider` + the `ColorScheme`
   helper) so light/dark works — see `apps/web/app/layout.tsx`.

**Rules of the road**

- Build new shared UI **here**, then consume it from `apps/web`. Don't create
  one-off components in the app.
- Components are presentational and data-driven: pass typed props, never embed
  sample/product copy, permissions, or tenant logic inside a component.
- Compose existing primitives before writing anything new.

---

## 2. Tokens & theming

All visual tokens are flat CSS custom properties in
[`src/styles/globals.css`](src/styles/globals.css), translated from the approved
**Aurora** direction. Aurora-light maps to `:root`, Aurora-dark to `.dark`.
They are registered in Tailwind's `@theme inline`, so use them as utilities
(`bg-background`, `text-muted-foreground`, `bg-primary`, `rounded-[var(--radius)]`).

- **Color roles** — `--background`/`--foreground`, `--card`, `--primary`,
  `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`/`--input`/
  `--ring`, the full `--sidebar-*` set, and **status roles** `--success` /
  `--warning` / `--info` (+ `-foreground`). Light/dark have parity.
- **Charts** — `--chart-1..5` (Aurora neon blend).
- **Structural (theme-independent)** — `--radius` (base `1rem`), typography
  (`--font-*`, weight/leading/tracking scales), layout dimensions
  (`--header-height`, `--rail-width`, `--nav-width`, `--inspector-width`,
  `--content-padding`), and elevation (`--shadow-xs..lg`, `--shadow-card`).

State tones map onto status roles with opacity tints (e.g. `bg-success/12`,
`bg-destructive/12`) — see the state components for the canonical usage.

### Tenant branding boundary

A tenant may **re-skin** the product by overriding **brandable color roles
only**, scoped to a `data-tenant` attribute. Tenants must **not** override
structural tokens (`--radius`, `--font-*`, layout dimensions, `--shadow-*`,
spacing) — those define layout/behavior and are shared across all tenants.
Override **both** themes for parity. (Full contract + example at the bottom of
`globals.css`.)

```css
[data-tenant="greenfield"] {
  --primary: #0f766e;
  --primary-foreground: #ffffff;
  --ring: #0f766e;
  --sidebar-primary: #0f766e;
}
.dark[data-tenant="greenfield"],
.dark [data-tenant="greenfield"] {
  --primary: #2cc9b4;
  --primary-foreground: #052420;
  --ring: #2cc9b4;
  --sidebar-primary: #2cc9b4;
}
```

---

## 3. Component catalog

### Primitives — `components/*`
shadcn-style building blocks: `avatar`, `badge`, `breadcrumb`, `button`,
`card`, `chart`, `checkbox`, `collapsible`, `drawer`, `dropdown-menu`, `input`,
`label`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`,
`table`, `tabs`, `toggle` / `toggle-group`, `tooltip`.

### Application shell (M3) — `custom/shell/*`
Aurora Layout A chrome, all data-driven via `types/shell.types.ts`:
`AppShell` (+ `ShellMain`), `AppHeader` (+ `OmniSearch`), `AppSidebar`
(icon rail · secondary nav · mobile tab bar), `SchoolSwitcher`, `UserMenu`,
`AppBreadcrumbs`, `PageHeader` (+ `SegmentedControl`).

### Navigation model (M4) — `lib/navigation.ts` + `types/{access,navigation}.types.ts`
Framework-agnostic, pure. `resolveNavigation(config, viewer, currentPath, opts)`
filters a declarative `NavigationConfig` by the same role / clearance /
permission / school-type vocabulary the backend authorizes against, collapses
empty groups, and marks the active route. Helpers: `canAccess`, `isRouteActive`,
`CLEARANCE_BY_ROLE`. The shell components carry **no** permissions/tenant logic —
this model decides what nav is offered; real authorization stays server-side.

### State & feedback (M5) — `custom/states/*`
Data-driven (copy is always consumer-supplied), tones map to status tokens,
ARIA-correct. `StateView` (base) → `EmptyState` / `ErrorState` (`role="alert"`) /
`ForbiddenState`; `LoadingState` + `Spinner`; skeleton patterns (`SkeletonText`,
`SkeletonList`, `SkeletonTable`, `SkeletonCardGrid`, `SkeletonForm`);
`NoticeBanner` + `OfflineBanner` / `ReadOnlyBanner`; `ValidationSummary`
(focusable, links focus the offending field). `ForbiddenState` pairs with the M4
model — access filtering hides nav, `ForbiddenState` covers direct/deep-link
access.

### Layout patterns (M6) — `custom/layouts/*`
Composition scaffolds (slots + typed data) that compose primitives, `PageHeader`,
and the M5 states: `StatGrid` / `StatCard`, `DashboardLayout`,
`ListDetailLayout`, `DataTableLayout` (wires `SkeletonTable` + `EmptyState`),
`FormLayout` / `FormSection` (wires `ValidationSummary`), `SettingsLayout` /
`SettingsNav`.

### Data display — `custom/data-display/*`
`StatusBadge` — a tone-driven status pill (Active / Suspended / Paid / Owing …)
for tables, list rows and detail panes. Reuses the M5 `StateTone` union and the
same status-token mapping as the state medallions, so tones read consistently;
optional leading `dot`. The base `Badge` primitive stays for brand/secondary/
destructive/outline variants.
`ScheduleGrid` — a weekly day × period schedule/timetable grid. Data-driven
(`days`, `SchedulePeriod[]`, `ScheduleEntry[]`); entries placed by (day, period)
with light `ScheduleTone` colour-coding. Scrolls horizontally on narrow
viewports instead of reflowing.
`Meter` — a labelled ratio / progress bar (`value` / `max`, optional label +
value text, `MeterTone` fill). Accessible `progressbar` role. Generalises the
one-off bars in the dashboard / finance surfaces.

### Charts — `custom/charts/*`
Typed, data-driven wrappers over the `chart` primitive + recharts, so app pages
consume a small typed API and **recharts stays confined to `packages/ui`** (it is
not a dependency of `apps/web`). Both take `data` rows + an `xKey` + a `series`
list (`ChartSeries` from `types/chart.types.ts`; colours default to the rotating
`--chart-1..5` tokens) and expose an accessible `role="img"` region.
`TrendChart` — multi-series `area` (gradient bands) or `line` over a category /
time axis; optional `stacked`, auto legend for >1 series.
`CategoryBarChart` — grouped or `stacked` bars, `column` (vertical) or `bar`
(horizontal) orientation.
Both set `isAnimationActive={false}` so marks paint at final geometry on mount
(no blank-chart flash; deterministic for SSR/snapshot rendering). The richer
`custom/charts/chart-area-interactive` (time-range toggle) remains for reference.
> recharts gotcha baked in: axis children are passed **directly** (never wrapped
> in a React fragment), since recharts discovers `XAxis`/`YAxis` by type and does
> not traverse fragments — wrapping them silently drops the axes.

### Utilities
`lib/utils.ts` → `cn()` (clsx + tailwind-merge). `hooks/use-mobile.ts`.
`custom/mode-toggle`, `custom/colors/color-scheme`.

---

## 4. Preview routes (component index)

Run the preview (`apps/web`) and browse:

| Route | Demonstrates |
| --- | --- |
| `/design-system` | Index + primitives (buttons, badges, form controls, cards) and links to the surfaces below |
| `/design-system/shell` | Full app shell with a persona switcher driving the M4 navigation model |
| `/design-system/states` | All M5 states (loading, skeletons, empty, error, forbidden, banners, validation summary) |
| `/design-system/layouts` | All M6 patterns (dashboard, list/detail, data table, form, settings) |

> **Local preview note (this machine).** macOS Privacy (TCC) blocks the preview
> launcher from reading `~/Documents`, so the default `web` launch config serves
> a self-contained build from `/tmp`. After editing source, rebuild + re-copy and
> restart — see `AI_HANDOFF.md` → Known Issues. Granting Documents/Full Disk
> Access to Claude restores normal `next dev` (the `web-pnpm` config).

---

## 5. Accessibility checklist

When building or reviewing a shared component:

- [ ] **Keyboard** — every interactive element is reachable and operable by
      keyboard; activation works with Enter/Space (use real `<button>`/`<a>`,
      not click-only `<div>`s).
- [ ] **Focus visible** — visible focus ring on focusable elements
      (`focus-visible:ring-[3px] focus-visible:ring-ring/50` is the house style).
- [ ] **Roles & live regions** — transient/loading surfaces use `role="status"`
      + `aria-busy`; errors use `role="alert"`. (M5 states already do this.)
- [ ] **Names** — icon-only controls have an accessible name (`aria-label`);
      decorative icons are `aria-hidden`.
- [ ] **Current state** — selected nav/section uses `aria-current`
      (`page`/`true`); active tabs use the Tabs primitive's `aria-selected`.
- [ ] **Focus management** — surfaces that appear after an action move focus
      appropriately (e.g. `ValidationSummary` is focusable and `autoFocus`-able
      on submit, with items linking focus to the offending field).
- [ ] **Color is not the only signal** — pair tone with text/icon (e.g. stat
      deltas show an arrow + label, not just color).
- [ ] **Contrast** — verify status/tone tints in **both** light and dark.

---

## 6. Responsive verification notes

- **Breakpoints** — Tailwind defaults; responsiveness is CSS-only (SSR-safe, no
  layout shift). Verify at **375** (mobile), **768** (tablet), **1280**
  (desktop), and **≥1536** (xl, where the shell shows the inspector).
- **Shell** — `< md` collapses the icon rail to a bottom tab bar and hides the
  secondary nav / inspector / status bar; `lg+` shows rail + nav; `xl+` adds the
  inspector.
- **Layouts** — `StatGrid` auto-fits and collapses to one column; `Dashboard`
  aside stacks under main `< lg`; `ListDetail` shows a single pane `< md`
  (`showDetail`); `DataTable` body scrolls horizontally; `Form`/`Settings`
  columns stack and the settings nav becomes a horizontal scroller.
- **States** — centered, layout-stable; titles/actions wrap without shifting.
- **Verified** — M3 shell, M5 states, and M6 layouts were each checked in light
  + dark at desktop and 375 mobile (see `AI_HANDOFF.md` per-milestone
  Verification sections).

---

## 7. Known gaps (Phase 2 candidates)

- **Nav → real session/router.** The M4 model is previewed with a simulated
  in-page route + persona switcher; wire it to the real `ViewerContext`
  (auth/session) and `usePathname` once product screens exist.
- **Unit tests.** Presentational components + the pure `resolveNavigation`
  resolver have no unit tests yet (resolver was cross-checked via a throwaway
  harness). Add real tests for `resolveNavigation` / `canAccess` / `isRouteActive`.
- **`@workspace/ui` lint script.** `pnpm --filter @workspace/ui lint` can't
  resolve `eslint` (package has no direct eslint dep); source is currently
  covered by `tsc` + the `web` lint. Add the dep / fix the script.
- **Lockfile.** Committed `pnpm-lock.yaml` is `lockfileVersion 5.4`; any
  `pnpm install` regenerates it to `9.0`. Regenerate + commit deliberately.
- **Aurora glass.** Glassmorphic surfaces are flattened to solid color roles
  (M2 decision); the decorative gradient field was not reintroduced.
- **Preview launcher / TCC.** See §4 and `AI_HANDOFF.md` → Known Issues.
- **Notification service (TD-002).** Unbuilt feature tracked in
  `TECHNICAL_DEBT.md`.
