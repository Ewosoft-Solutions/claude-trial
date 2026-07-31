# 08 · Design-system bridge — the legacy system surfaces → Aurora

The whole point of the parity is **capability parity presented through one cohesive system**. This doc maps every recurring the legacy system surface onto our real Aurora primitives so "our own design system" is a concrete instruction, not an aspiration.

**Aurora facts used here** (source: `packages/ui/src/styles/globals.css` + [docs/design-tokens.md](../../../docs/design-tokens.md)):

- **Three themes**, full parity, instant + global: `:root` (Aurora light), `.dark` (Aurora dark — default), `.classic-dark`. Toggle via `mode-toggle`.
- **Token-driven, never hard-coded hex.** Surfaces `--background/--card/--popover/--muted/--sidebar/--border`; text `--foreground/--muted-foreground`; brand/status `--primary/--success/--warning/--info/--destructive`; charts `--chart-1..5`; gradients `--grad-primary` (CTAs), `--h1-grad` (titles/big stat numbers).
- **Canonical consumers:** `StatusBadge` (soft pill; tones neutral/info/success/warning/destructive) and `Meter` (ratio bar). Charts via `chart`/`TrendChart`. People via `neonAvatarColor(seed)`.
- **Primitives available:** `button, card, dialog, drawer, sheet, table, tabs, select, dropdown-menu, checkbox, toggle-group, input, label, textarea, otp-input, password-input, password-strength, breadcrumb, sidebar, skeleton, scroll-area, tooltip, separator, avatar, badge`, plus `custom/{shell, headers, layouts, sections, tables, data-display, charts, chat, states}`.
- Per memory: every route has a `loading.tsx` from ui page-skeletons using `@container/main` breakpoints; brand customization is logo + contrast-safe colors only — **no per-tenant layout/behavior override**.

---

## A · Global chrome

| the legacy system                                                                                                                  | Problem                                                      | Aurora                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy green/gold deep sidebar (C017) + a **second** modern indigo product embedded inside it (C019/C095) — two visual generations | no cohesion; theme drift                                     | one `custom/shell` app shell + `sidebar`; **one** visual system across all workspaces; `.dark` default, `--sidebar` surface            |
| "**Expires 2026-08-31 · Pay Now**" nag inside every work area (C016+)                                                              | commercial detail bleeds into operations, shown to all roles | move billing to account settings; if a system notice is needed, a dismissible banner using `--warning`, never persistent in workspaces |
| "**Switch School**" + "**Change theme**" gold buttons (C017)                                                                       | ad-hoc chrome                                                | campus/profile switcher in the shell context bar; theming via `mode-toggle` (system + manual, instant/global)                          |
| Breadcrumb-as-title "Configuration > Set Subject" (C113)                                                                           | title = raw path                                             | `breadcrumb` + a `custom/headers` page header; `--h1-grad` for the title                                                               |
| Repeated class/term/session selectors on every page (C044+)                                                                        | context re-selected constantly                               | a persistent **academic-context bar** in the shell; workbenches inherit it                                                             |

## B · Dense data tables

The legacy system tables (All-Staff C026, View-All-Students C043, Sent-SMS 19,539 rows C107, CBT 18 columns C062) are tiny, striped, expose contact PII by default, and repeat View/Edit/Delete.

| Rule                                                      | Aurora                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| One directory per entity, server-side page/filter/sort    | `custom/tables` DataTable over `table`; URL-backed view state               |
| Status as a **soft pill, not colour-only**                | `StatusBadge` (border + `/12–15` fill + tone text) — passes non-colour a11y |
| Contact **masked by default**, reveal on demand + audited | column privacy presets by role                                              |
| Bulk actions                                              | row selection + a bulk-action bar (`button` group)                          |
| Quick look vs deep work                                   | `drawer` detail vs full route                                               |
| Ratios/percentages (attendance %, paid %)                 | `Meter`, not a bare number                                                  |
| People cells                                              | `avatar` + `neonAvatarColor(seed)` (retire per-staff QR, C026)              |
| Large histories                                           | `scroll-area` + skeletons; cursor pagination                                |

## C · Status vocabulary → `StatusBadge` tones

A single mapping kills the legacy system's colour chaos (green pills, red pills, gold flags):

| Domain state (the legacy system)                            | Tone          | Token           |
| ----------------------------------------------------------- | ------------- | --------------- |
| Paid · Present · Approved · Active · Delivered · Enabled    | `success`     | `--success`     |
| Due · Pending · Awaiting review · Watch · Partial · At-risk | `warning`     | `--warning`     |
| Owing · Failed · Rejected · Disabled · Overdue · Absent     | `destructive` | `--destructive` |
| Submitted · Interviewed · Shortlisted · Info · DND-class    | `info`        | `--info`        |
| Draft · Withdrawn · Archived · Not-specified · N/A          | `neutral`     | `--muted`       |

Admissions stages (C020 Pending/Shortlisted/Invited/Interviewed/Admitted/Rejected), result states (C112 draft/published/locked/amended), and delivery states (C107 sent/failed/DND) all render through this one component.

## D · Forms & wizards

| the legacy system                                                                   | Problem                            | Aurora                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Monolithic registration form owning identity+admission+guardian+health+house (C032) | one giant page, placeholder labels | progressive sections by job in `card`s; persistent `label`s; correct input types; `input/select/textarea/checkbox`                                     |
| Multi-step invite/create wizards (C002–C013)                                        | good pattern, keep it              | `dialog`/`sheet` stepper + a **review step** (impact summary, not a checkbox); the legacy system's async validation (C014) → keep as inline validation |
| Password creation / "Generate Password" (C034)                                      | insecure                           | **never** generate/transmit; `password-input` + `password-strength` (already built) on the user's own set-password flow                                |
| Checkbox "I agree the amount is correct" (C082/C090)                                | fake confirmation                  | typed/impact confirmation for irreversible actions                                                                                                     |
| Long editors, desktop-only lesson editor (C067)                                     | mobile gap                         | `textarea`/rich editor with autosave drafts; mobile-first                                                                                              |

## E · Permissions UX (not 305 checkboxes)

The legacy system's VIEW/EDIT matrix over incoherent buckets (C006–C010) and "Select All" (C005) becomes:

- Role template picker (`select`) → capabilities in plain language (`card` list) → **scope** picker (campus/class/subject/self/child via `select`/`toggle-group`) → exception search → **sensitive actions surfaced separately** (`StatusBadge` `destructive`) → **separation-of-duties conflicts** (`--warning` callout) → **effective-access preview** (plain-English, `custom/sections`) → who's-affected count → reason + step-up + approval.
- The underlying grid, where shown, uses `checkbox`/`toggle-group` with our `resource.action.context` verbs — not a VIEW/EDIT binary.

## F · Dashboards & charts

The legacy system ships a chart museum: 40+ tiny subject donut gauges (C133), a teacher board that says 0 classes / 706 subjects (C058), many unexplained zeros (C131).

| Rule                        | Aurora                                                                        |
| --------------------------- | ----------------------------------------------------------------------------- |
| Task-first over chart-first | Overview = exceptions/approvals/today via `custom/sections` + `custom/states` |
| Big numbers                 | stat tiles with `--h1-grad`                                                   |
| Series charts               | `chart`/`TrendChart` cycling `--chart-1..5` (+ `--chart-glow` in Aurora)      |
| Ratios/gauges               | `Meter` (not 40 donuts)                                                       |
| Every tile                  | name + plain definition + period + scope + freshness + drilldown              |
| No data                     | explicit empty state (`custom/states`), never a zero that reads like success  |

Follow the **dataviz** skill for any new chart: form heuristic, `--chart-N` palette, light/dark validation, accessible text alternative.

## G · States (the "OOPS" fix)

The legacy system shows a bare **"OOPS! You're not authorized"** (C130), blank pages, and zero-states that look like success.

| State                     | Aurora (`custom/states`)                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| Loading                   | `skeleton` page-skeletons (already per route) + `@container/main` breakpoints                      |
| Empty / first-run         | illustrated empty state + primary action                                                           |
| No results                | filter-aware empty state                                                                           |
| **Permission denied**     | explains _what's unavailable, why (safe level), who can help_ — not "OOPS" (route: `unauthorized`) |
| Offline / partial / stale | sync badge + `--warning`; local/syncing/synced/conflicted/failed                                   |
| Error                     | recoverable error card + retry                                                                     |
| Success                   | toast (already shipped)                                                                            |

## H · Money & academic semantics

- Money in **kobo** (already our `FeeInvoice`), NGN formatting; **owing = `--destructive`, paid = `--success`, due/at-risk = `--warning`** (matches token roles). Never negative-amount reversals (C096) — reversals are contra entries with their own row.
- Grade bands render via `StatusBadge`/`Meter` against a **versioned** `GradingScaleVersion`, so migrated garbage ("Exce", "A ve", C114) is cleaned on import, not displayed.
- Result publication/lock/amend states use `StatusBadge` (`neutral`→`success`→`warning`) with an immutable-artifact link, never a mutable-row colour.

## I · Engagement composer

Three the legacy system channels (C103/C106/C109) → **one** composer: `drawer`/`sheet` with audience chips (`badge`), channel toggle (`toggle-group` SMS/Email/In-app), template select, **cost estimate** (`Meter` against SMS balance, C105/C107), and a delivery view where each `DeliveryAttempt` shows provider + status + DND/cost via `StatusBadge`. Result/payment links become access-controlled `SecureLink`s, not public URLs (C108).

## J · Theming & tenant brand

- Full **light / Aurora-dark / classic-dark** parity, no loss of hierarchy — every surface above is defined in all three (docs/design-tokens.md §1–2).
- Tenant brand = **logo + primary/secondary/accent within contrast-safe bounds + approved font** (PRD A2). The legacy system let schools upload a logo + 6 officer signatures as raw images (C126) and a gold theme swatch (C017); we keep logo + a **contrast-checked** brand color feeding `--primary`, and signatures become governed `SigningAuthority` assets — **no per-tenant layout or component-behavior override.**
- Result templates (C130) become themeable, tokenized artifact layouts — not per-school HTML.

## K · Accessibility mapping (WCAG 2.2 AA)

| the legacy system risk                     | Aurora mitigation                                              |
| ------------------------------------------ | -------------------------------------------------------------- |
| Colour-only status pills (C026)            | `StatusBadge` = border + text + fill (non-colour cue)          |
| Tiny targets, QR/icon-only (C026/C062)     | ≥24px targets; `tooltip` + accessible names; `button` variants |
| Dense tables without semantics (C043/C107) | semantic `table`; responsive alternatives                      |
| Invisible focus                            | `--ring` focus token on every interactive element              |
| Modal focus risk (C111 detail modal)       | `dialog`/`drawer` trap + restore focus                         |
| Motion                                     | reduced-motion respected; Aurora glow is decorative-only       |

## L · Component inventory — the mapping at a glance

| the legacy system pattern (C)               | Aurora component                                               | Primary token(s)                                   |
| ------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------- |
| Sidebar app + embedded sub-apps (C017/C019) | `custom/shell` + `sidebar`                                     | `--sidebar`, `--background`                        |
| Green/gold buttons (C018)                   | `button` (default = `--grad-primary`, white text)              | `--primary`, `--grad-primary`                      |
| Status pills (C026/C112/C107)               | `StatusBadge`                                                  | `--success/--warning/--destructive/--info/--muted` |
| Dense grids (C026/C043/C062/C107)           | `custom/tables` + `table` + `scroll-area`                      | `--card`, `--border`, `--muted`                    |
| % / ratios (attendance, paid, CBT scores)   | `Meter`                                                        | `--success/--warning/--destructive`                |
| Subject gauges / trends (C131/C133)         | `chart` / `TrendChart`                                         | `--chart-1..5`, `--chart-glow`                     |
| Wizards/steppers (C002–13)                  | `dialog`/`sheet` + review section                              | `--popover`                                        |
| Detail quick-look (C111)                    | `drawer`                                                       | `--popover`                                        |
| Tabbed products (C019/C099/C100)            | `tabs`                                                         | `--accent`                                         |
| Big stat numbers (C058/C131)                | header + `--h1-grad`                                           | `--h1-grad`                                        |
| Permission matrix (C004–10)                 | `checkbox`/`toggle-group` + effective-access `custom/sections` | `--foreground`, `--warning`                        |
| "OOPS"/blank/zero (C130/C131)               | `custom/states` + `skeleton`                                   | `--muted-foreground`                               |
| Per-staff QR/initials (C026)                | `avatar` + `neonAvatarColor`                                   | neon palette                                       |
| Password flows (C034)                       | `password-input` + `password-strength` + `otp-input`           | `--ring`, tones                                    |
| Theme switch (C017)                         | `mode-toggle`                                                  | all themes                                         |

---

## The one-line brief for design

> Take the legacy system's **jobs** and render them with **Aurora primitives + tokens** in a **calm, token-driven, light/dark-parity, WCAG-2.2-AA** system: one directory per entity, one workbench per lifecycle, `StatusBadge`/`Meter` for every state, `custom/states` for every empty/error/permission case, masked PII by default, and **zero hard-coded colours** — so a school gets everything it had from the legacy system, presented as one product instead of two visual generations stitched together.
