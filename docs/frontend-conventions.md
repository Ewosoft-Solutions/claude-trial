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

### The drawer shell is shared — don't hand-roll it

Chrome comes from `@workspace/ui/custom/detail/drawer-chrome`, tabs from
`@workspace/ui/custom/detail/drawer-tabs`. Every drawer wears the same shell, and these components are
where that lives:

| part       | component       | what it fixes                                                                                                                                              |
| ---------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| panel      | `DrawerContent` | the width (`size`, §3) and the column layout that pins header and action bar while only the body scrolls                                                   |
| top bar    | `DrawerHeader`  | `bg-sidebar` — the **app top bar's** own surface, so drawer chrome and app chrome are the same colour                                                      |
| title      | `DrawerTitle`   | display face at **22px × `--font-scale`** — deliberately under a page's 24px `PageTitle`, so a drawer never competes with the page behind it               |
| tabs       | `DrawerTabs`    | the folder-tab strip: the rule sweeps up around the active tab                                                                                             |
| action bar | `DrawerFooter`  | same `bg-sidebar` as the header, so the chrome brackets the content                                                                                        |
| body       | _(nothing)_     | keeps the sheet's `bg-background` — the token a **page's main region** uses, so cards and inputs sit on the same ground and lift the same way as on a page |

Pass `flush` to `DrawerHeader` when a `DrawerTabs` strip follows: the strip paints the boundary rule
itself, so the header must not draw a second one.

Two rules the shell depends on, worth knowing before overriding it:

- **Card surfaces are opaque `bg-card`, never `bg-card/40`.** A percentage wash takes its tint from the
  ground beneath it, so over the warm canvas it renders cream (`#fafaf8`) where a page card is white.
- **`--border` is translucent.** Anywhere two things draw the same 1px line they composite (0.1 over 0.1
  reads as 0.19 — about double weight) and the seam looks retraced. `DrawerTabs` masks under its joins
  for exactly this reason.

## 3 · Choosing a surface — modal, drawer, or route

§2 settles _reading_. This settles everything else: where a create/edit form, an action, or a
confirmation lives. It exists because "New application" shipped as a drawer while "Add a role" shipped
as a modal and both felt defensible — there was no rule to appeal to.

**The axis is not size — it is what the surface does to the page behind it.** A modal is not the small
version of a drawer; it is the _blocking_ one. Ask in order, first yes wins:

| #   | Ask                                                                           | Surface               |
| --- | ----------------------------------------------------------------------------- | --------------------- |
| 1   | Must this be resolved before the app can continue?                            | **Modal** (`Dialog`)  |
| 2   | Is it a task _about_ one object, with the page behind it as useful reference? | **Drawer** (`Sheet`)  |
| 3   | Is it a workspace in its own right — long, linkable, returned to?             | **Route** (`/…/[id]`) |

The ladder is **drawer → route**. A modal sits _off_ the ladder: when something outgrows a drawer it
becomes a route, never a bigger modal.

### Modal — the interrupting surface

Reserved for work that must block: destructive or irreversible confirmations, session and step-up
interrupts, and single decisions cheap enough to lose. A modal must be answerable **without seeing what
is behind it**.

**A modal must never scroll.** `max-h-[…] overflow-y-auto` on a `DialogContent` is the signal that the
content outgrew the shell — the fix is a drawer, not a taller modal. Our `--font-scale` (90–110%) makes
this bite: a modal that fits at 100% scrolls at 110%.

The practical bound: **one decision, ≤5 fields, no scroll, `sm:max-w-md`**. Past any of those, it is a
drawer.

### Drawer — the default for everything else

Creating, editing or reviewing one object is a drawer. It may be tall, scrollable and tabbed at no cost;
it keeps the list behind it as context; it becomes full-screen on mobile for free; and half-finished
work in it survives a mis-click.

**Every create/edit form is a drawer, whether or not it scrolls.** The scroll test says when a modal is
definitely wrong; it never says one is right. "It happens to fit" is not a reason to leave a form in a
modal. This is precisely what the first sweep got wrong — it filtered on _scrolling_ modals, so nineteen
create/edit forms that happened to fit stayed modals until a second pass caught them.

A **form** drawer wears the same shared chrome as a **detail** drawer (§2):

```tsx
<Sheet open={open} onOpenChange={setOpen}>
  <DrawerContent>
    <DrawerHeader className="gap-1.5">
      <DrawerTitle className="pr-8">New application</DrawerTitle>
      <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
        …
      </SheetDescription>
    </DrawerHeader>
    <div className="flex-1 overflow-y-auto px-5 py-5">{/* form */}</div>
    <DrawerFooter className="flex-row justify-end gap-2">
      <SheetClose asChild>
        <Button variant="ghost" size="sm">
          Cancel
        </Button>
      </SheetClose>
      <Button size="sm">Create</Button>
    </DrawerFooter>
  </DrawerContent>
</Sheet>
```

**The primary action belongs in `DrawerFooter`, never in the body.** A form promoted from a modal
usually has its submit as the last cell of the field grid; left there it scrolls away with the fields
and the drawer has no action bar at all. Four of the converted forms shipped that way before it was
caught.

**Canonical example:** the create sheet in `students/admissions/admissions-workspace.tsx`.

#### Width is a prop, not a class

`DrawerContent` (`@workspace/ui/custom/detail/drawer-chrome`) owns the panel — its width and the
column layout that keeps the header fixed while only the body scrolls. There are **two** sizes:

| size                   | px  | for                                                                 |
| ---------------------- | --- | ------------------------------------------------------------------- |
| `standard` _(default)_ | 576 | every detail drawer and every form                                  |
| `wide`                 | 672 | content bringing its own table or matrix (report card, access grid) |

Don't reach past the prop with a `sm:max-w-*` of your own. The app previously ran four widths
(448/512/576/672) that tracked read-vs-edit; 512 → 576 is a 64px step that a user notices without
learning anything from, which is the one kind of variation worth removing. 576 → 672 is kept because
a matrix genuinely wraps below it.

`SheetContent`'s own `sm:max-w-sm` default is deliberately left alone — it also backs the nav and
command-palette sheets, where a 576px floor would be wrong. Detail and form drawers come through
`DrawerContent`.

#### Promoting a modal? re-read its layout, not just its shell

A modal is as wide as the viewport lets it be; a drawer is 576px. Swapping the shell without reading
the layout inside it is where every regression in this work came from:

- **Grids sized for the old width.** `sm:grid-cols-3` gives ~178px columns at 576px and
  `lg:grid-cols-4` gives ~134px — enough to truncate a "Choose campus" placeholder. Two columns is the
  ceiling inside a `standard` drawer.
- **A `col-span` wider than the template wins.** A child left on `lg:col-span-4` forces four implicit
  tracks no matter what the container declares, so the grid silently stays four wide and no CSS rule
  matching the container explains it. Narrow the container and its spans together.
- **Truncation eats the last thing on the line.** A single `truncate` span holding
  `id · term • ₦ owing` loses the money first. Give the identifier its own truncating span and leave
  the figure `shrink-0` — money always renders in full.
- **Wrappers that only worked because the modal was roomy.** A bare `<div className="py-2">` holding
  six fields has no gap at all; a wide modal made that survivable and a drawer does not.

Layout faults like these are usually _pre-existing_ — the modal was concealing them. Reading the diff
won't show them; open the drawer.

### Inline disclosure is not a surface for actions

An action or a form does **not** get an in-page panel that toggles open. It reflows the page, it makes
one screen's layout unlike every other's, and no shared shell governs it — the Users invite panel
drifted into a primary-gradient "Close" button still wearing a `UserPlus` icon precisely because
nothing did.

Inline `Collapsible` survives in exactly two places:

- **navigation groups** — the sidebar's own tree; and
- **optional or advanced fields inside a form the user is already filling**, where the disclosed inputs
  save with the parent form and have no submit of their own.

Everything else — invite panels, correction forms, per-row detail expansions — is a drawer.

#### An always-present editable row is content, not a disclosed panel

The ban is on a surface that **toggles open over** a screen. A control that is simply _there_ whenever
the object is editable — the entry row at the foot of its table, the qty stepper on a line — is part of
the table's own shape, and stays inline.

The test: does it appear on a click and reflow what was already on screen (drawer), or is it in the
table's shape the whole time the object is editable (inline)?

**Canonical example:** the invoice lines table (`finance/invoices/[id]/invoice-detail-client.tsx`).
Composing a bill used to be a modal per line — open, pick, type, save, wait, repeat — a form covering
the very figures it changes. It is now the last row of the table: pick a fee item, type the amount,
Enter commits it and hands the cursor back for the next one. Editing an existing line's amount, which
carries a note and is not a per-keystroke concern, is still a modal (one decision, ≤ 5 fields).

A route that is a compose surface also keeps its running total in view — `InvoiceTotalsBar` is
`sticky bottom-0` inside the scroll column, so the figure being changed never scrolls away from the
work changing it.

### Two hard bans

- **No modal over a modal.** Drawer → modal (a confirm raised from a drawer) is correct and expected;
  modal → modal leaves no way back.
- **No unsaved work behind a click-outside dismiss.** Drawers hold in-progress forms; modals hold only
  work cheap enough to lose.

### One drawer family

`Sheet` (`@workspace/ui/components/sheet`) is _the_ drawer, and there is no second overlay family. The
vaul-backed `Drawer` was retired: the component is deleted and the dependency dropped, so `Drawer*` in
this codebase now means the shared chrome in `@workspace/ui/custom/detail/drawer-chrome` — built on
`Sheet` — and nothing else. While both existed the collision was a live trap: two different
`DrawerContent` symbols, one a side panel and one a bottom sheet, told apart only by import path.

Don't reintroduce a bottom-sheet library for something a `Sheet` already carries: `SheetContent` takes
`side="bottom"` (the mobile filter sheet in `directory-toolbar` is the example). And note what retiring
vaul settled — `_shared/step-up-prompt` was a bottom sheet only because vaul was to hand. It is a
**modal**: a blocking re-auth interrupt is the textbook case for one.

## 4 · State reads through semantic `StatusBadge` tones

Lifecycle/status/decision values render through **`StatusBadge`** with a semantic `StateTone`
(`neutral | info | success | warning | destructive`) — `@workspace/ui/custom/data-display/status-badge`.
Never hand-pick a colour on a row.

## 5 · Routing — nest under the domain segment

A screen lives under the URL segment of the domain it belongs to, and the **nav label matches the route**:

- student lifecycle **including admissions** → `/students/*` (e.g. `/students/admissions`,
  `/students/directory`, `/students/fees`) — the attendance/transport rosters
  live under their modules (`/attendance/students`, `/transport/riders`);
- academics (structure, class enrolment, lifecycle, promotion, results) → `/academics/*`;
- finance → `/finance/*`.

The `/api/<domain>/*` proxy path tracks the **backend** route and does **not** move when a page route
moves (e.g. pages at `/students/admissions/*` still call `/api/admissions/*`). When a page route moves,
add a `next.config` redirect from the old path so links keep working.

## 6 · Also standing

- **Every route has a `loading.tsx`** from the ui page-skeletons, using `@container/main` breakpoints.
- **Defensive access at trust boundaries** — golden rule #9 (`serverApiGet` can return `null`, incl. an
  empty `200` body; props/params can be missing). Render empty states, never a `TypeError`.
- **Permissions gate server-side**; a component reads `session.permissions` only to hide/disable UI.

## Reviewer checklist (a list screen is "done" when)

- [ ] `ShellMain` + `PageHeader` + `StatGrid` + `DirectoryTable` (Pattern-B `search`/`filters`), no bespoke table
- [ ] row → `Sheet` drawer; deep edit → `/.../[id]` route
- [ ] surfaces chosen by §3 — a modal only if it blocks _and_ doesn't scroll; **every** create/edit is a
      drawer whether or not it scrolls; no inline panel that toggles open for an action or form
- [ ] drawers use `DrawerContent` with `size` (`standard` / `wide`) — no hand-written `sm:max-w-*`
- [ ] the drawer's primary action sits in `DrawerFooter`, not loose at the end of the body
- [ ] statuses via `StatusBadge` semantic tones; counts/money via `format.ts`
- [ ] route nested under its domain segment; nav label matches; redirect added if a route moved
- [ ] `loading.tsx` present; trust-boundary reads guarded
