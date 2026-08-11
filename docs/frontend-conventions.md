# Frontend conventions (enforced)

The conventions a web screen must follow. This is the reference behind **AGENTS.md golden rule #10**;
reviews and the DoD check new UI against it. It exists because the admissions surface shipped a bespoke
table at a top-level `/admissions` route while the design-system + `/students/*` conventions already
existed only as unwritten intent — so nothing flagged the drift. Written down, that stops.

## 1 · Entity list screens use the governed table (not a bespoke `<table>`)

A screen that lists an entity (applications, students, invoices, staff…) is built from:

- **`ShellMain`** (page container) + **`PageHeader`** (`title` / `description` / `actions`) —
  `@workspace/ui/custom/shell/{app-shell,page-header}`. Not a hand-rolled `<header>` + `PageTitle`.
- A **`StatGrid`** summary of the collection — `@workspace/ui/custom/layouts/stat-grid`. Counts go
  through `formatCount`, money through `formatNaira` (`apps/web/lib/format.ts`) — never `String(n)`.
- The governed **`DirectoryTable`** — `@workspace/ui/custom/tables/directory-table` — with the
  **Pattern-B toolbar** enabled by passing `search` + `filters` (+ optional `views` for saved views).
  Columns are `DirectoryColumn`s (`sortable` / `hideable`); rows open a drawer via `onRowClick`.
- A filter-aware **`EmptyState`** — `@workspace/ui/custom/states/page-states`.

**Canonical example:** `apps/web/app/(app)/students/admissions/admissions-workspace.tsx`.

## 2 · Quick-look is a drawer; deep work is a route

Clicking a row opens a **`Sheet` drawer** (`@workspace/ui/components/sheet`) with an at-a-glance summary
and an "Open full detail" link. The full detail/edit is its **own route** (`.../[id]`). Don't cram deep
editing into the drawer, and don't force a route hop for a glance.

Build the drawer from the shared **detail primitives** — `Section` / `DetailGrid` / `Field` /
`StatTiles` from `@workspace/ui/custom/detail/detail-primitives` — so every drawer reads with the same
hierarchy (a `Section` title is bold/foreground; a `Field` label is small + muted). The house pattern
(see `people/person-detail-drawer.tsx` and `students/admissions/application-drawer.tsx`): a header with
an avatar + name + status chips + a lightweight tab bar, a scrollable `@container/tiles` body of
`StatTiles` + `Section`s, proper loading/error states, and a footer action. Fetch on open via
`/api/…`, aborting on close.

## 3 · State reads through semantic `StatusBadge` tones

Lifecycle/status/decision values render through **`StatusBadge`** with a semantic `StateTone`
(`neutral | info | success | warning | destructive`) — `@workspace/ui/custom/data-display/status-badge`.
Never hand-pick a colour on a row.

## 4 · Routing — nest under the domain segment

A screen lives under the URL segment of the domain it belongs to, and the **nav label matches the route**:

- student lifecycle **including admissions** → `/students/*` (e.g. `/students/admissions`,
  `/students/directory`, `/students/attendance`);
- academics (structure, class enrolment, lifecycle, promotion, results) → `/academics/*`;
- finance → `/finance/*`.

The `/api/<domain>/*` proxy path tracks the **backend** route and does **not** move when a page route
moves (e.g. pages at `/students/admissions/*` still call `/api/admissions/*`). When a page route moves,
add a `next.config` redirect from the old path so links keep working.

## 5 · Also standing

- **Every route has a `loading.tsx`** from the ui page-skeletons, using `@container/main` breakpoints.
- **Defensive access at trust boundaries** — golden rule #9 (`serverApiGet` can return `null`, incl. an
  empty `200` body; props/params can be missing). Render empty states, never a `TypeError`.
- **Permissions gate server-side**; a component reads `session.permissions` only to hide/disable UI.

## Reviewer checklist (a list screen is "done" when)

- [ ] `ShellMain` + `PageHeader` + `StatGrid` + `DirectoryTable` (Pattern-B `search`/`filters`), no bespoke table
- [ ] row → `Sheet` drawer; deep edit → `/.../[id]` route
- [ ] statuses via `StatusBadge` semantic tones; counts/money via `format.ts`
- [ ] route nested under its domain segment; nav label matches; redirect added if a route moved
- [ ] `loading.tsx` present; trust-boundary reads guarded
