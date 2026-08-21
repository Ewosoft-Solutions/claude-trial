# Instant navigation — route audit

**Principle (AGENTS.md golden rule 11):** a click must paint within a frame —
the destination's chrome plus a skeleton of its real shape — and only then
stream the data in. A user who clicks and sees nothing assumes the click was
lost, and clicks again.

Re-run the audit after adding any route or any `async` layout:

```bash
node scripts/audit-nav-boundaries.mjs
```

It exits non-zero when a segment `await`s with no Suspense boundary above it,
so it can gate CI.

---

## The rule that made this non-obvious

A segment's own `loading.tsx` wraps that segment's **children**. Its
`layout.tsx` wraps the loading UI in turn. So:

| Awaiting in… | Covered by its own `loading.tsx`? | Covered by an ancestor's? |
| --- | --- | --- |
| `page.tsx` | **yes** | yes |
| `layout.tsx` | **no** | **yes — the only option** |

Every section layout in this app opens with a permission check
(`requirePermission` → `getSession` → a real `/auth/me` round trip). None of
them could be covered by their own `loading.tsx`, and there was no boundary
above them — so **every first navigation into a section blocked on the network
with nothing painted**. That was the whole bug.

---

## Findings and status

Baseline: 109 routes.

| # | Finding | Scope | Status |
| --- | --- | --- | --- |
| 1 | 18 async section layouts with no boundary above them — every section change blocked | 96 routes | **Fixed** — one file, `apps/web/app/(app)/loading.tsx` |
| 2 | Person profile re-rendered its whole shell on every tab click; `[id]/loading.tsx` was a whole-page skeleton, so the header was torn down and rebuilt each time | `/people/[id]/*` | **Fixed** — chrome hoisted into `[id]/layout.tsx`; `loading.tsx` narrowed to `DetailBodySkeleton` |
| 3 | 3 async pages with no boundary at all | `(auth)/login`, `(portal)/apply/[slug]`, `(portal)/status/[token]` | **Fixed** — boundaries added (bare primitives; these sit outside the app shell) |
| 4 | Root and `(app)` layouts await with no boundary above | cold load only | **Accepted** — a layout is not re-rendered when navigating between its children, so neither can cause a dead-feeling click; the browser shows its own progress during a document load. Allowlisted in the audit script with the reasoning. |

### Fix 1, in detail

`(app)/loading.tsx` is deliberately plain (`DetailBodySkeleton sections={2}`).
It shows only for as long as a permission check takes and hands straight over
to the section's own, better-shaped skeleton. Anything more detailed would be a
second shape flashing past.

---

## Pass 2 — skeleton shape sweep (done)

All 90 painting routes compared against what their pages actually render, via
`node scripts/audit-skeleton-shapes.mjs` (a second gate; exits non-zero on a
suspect shape).

| Result | Count |
| --- | --- |
| Skeleton matches the page's silhouette | 67 |
| Accepted exception, reason recorded in the script | 7 |
| Inherits a parent's boundary (no own `loading.tsx`) | 16 |
| Redirect-only, never paints | 19 |
| **Suspect** | **0** |

**Nine reshaped.** Seven academics/classes pages (`promotion`, `transcripts`,
`lifecycle`, `results`, `lessons`, `structure`, `classes/timetable`) painted a
`TablePageSkeleton` — a toolbar and rows of table — while rendering
`PageHeader` + cards and no table at all. They now use `DetailPageSkeleton`.
`settings/ai-usage` moved off `ReportPageSkeleton` for the same reason, and
`events/[id]/roster` moved *to* `TablePageSkeleton` because it really is a
governed table.

`DetailPageSkeleton` gained a `withTabs` option so a tabbed page's strip does
not pop in after the skeleton clears. Applied to `academics/lifecycle` and
`academics/lessons`, whose tabs are top-level — and deliberately **not** to
`academics/results`, where the tabs sit inside a card and only appear once a
cycle is selected. That one was caught by opening the page, not by the script.

Board: **https://claude.ai/code/artifact/08659c72-b942-4f16-9ed1-c84d564e0653**

---

## Pass 3 — client-side fetch waterfalls (done)

The route boundary makes the FIRST paint instant. This pass covered the second
stage: a client component that fetches on mount and, while waiting, shows a
line of text or a bare pulsing slab instead of a skeleton of its content.

Both are the same defect from the reader's side — the card is a different size
and shape before and after the data lands, so the page jumps — and a text
"Loading…" tells a screen reader nothing, because it is not in a busy region.
The shared primitives in `@workspace/ui/custom/states/skeletons` are
`role="status"` busy regions *and* the right silhouette.

Gate: `node scripts/audit-loading-states.mjs` (333 client files, exits
non-zero on a regression).

**19 sites across 15 files.**

| Was | Where | Now |
| --- | --- | --- |
| `Loading access…` text | person profile → Access & scope | `SkeletonList rows={3}` |
| `Loading…` text | 6 dashboards (admin, finance, teacher, student, parent, platform ×3) | `SkeletonList rows={3}` |
| `Loading…` text | platform analytics, policies, tenant detail, audit drawer | `SkeletonList` / `SkeletonText` |
| `h-24 animate-pulse` slab | person profile → Account & access, Employment, Guardianship | `SkeletonList` |
| `h-40 animate-pulse` slab | roles manager (×2) | `SkeletonList rows={4}` |
| `Loading…` text | platform dashboard → School growth chart | 12 bars at the chart's exact height, so the card does not resize |

Verified in the browser on a live session: the person profile now paints ten
skeleton regions and **zero** bare "Loading…" strings, and the overview
dashboard four regions and zero.

---

## Pass 4 — the dead click between click and commit (measured)

A skeleton only helps once the router has committed. Measured on a live
session, it does not commit until the new route's RSC payload has arrived:

| | Cold route (dev compile) | Warm route |
| --- | --- | --- |
| RSC request duration | 2752 ms | 200–350 ms TTFB, 340–620 ms total |
| URL changes at | 2970 ms | ~520–580 ms |
| First visible feedback | 2970 ms | ~520–580 ms |

`urlChanged === firstFeedback` in every sample: the router shows the old page
until the payload lands, then swaps everything at once. That is the frozen
click — nothing is stuck, the feedback is simply downstream of the network.

**Three things this is NOT.** Worth recording, because each is a plausible
guess that the measurements rule out:

- *Not request cancellation.* Only one RSC request is ever in flight; nothing
  is queued behind a stale call, so aborting one frees nothing. The next
  navigation still has to fetch its own payload.
- *Not a missing Suspense boundary.* Every route has one (pass 1).
- *Not the page awaiting before it returns JSX.* Tried moving the awaits into
  a `<Suspense>`-wrapped child so the shell could flush first; time-to-first-
  byte was unchanged (229/207 ms streaming vs 187/267 ms blocking). Reverted
  rather than keep a change that bought nothing.

**What actually fixed it: optimistic selection.** The tab strip now moves the
selection on click and lets the pathname confirm it afterwards, so the click
is acknowledged immediately instead of when the network returns.

| | Before | After |
| --- | --- | --- |
| Tab visibly moves | 518 ms / 1219 ms | **30 ms / 19 ms** |

The pathname stays the authority: if the navigation fails or the reader hits
Back, the strip snaps to the real route. `FolderTabLinks` gained `onTabClick`
for this, and marks itself `aria-busy` while a selection is in flight so the
change is not a sighted-only cue.

**Still open on this front:**

- *Dev compilation dominates first visits.* A cold route cost ~2.7 s of the
  ~3 s. That is Turbopack, not the app, and it does not exist in production.
- *Production prefetch is unverified.* `<Link>` prefetches on viewport/hover in
  production, which should let the router commit instantly; Next disables it in
  dev, so it could not be measured here. Worth confirming against a real build
  before assuming it.
- *~123 KB per tab switch.* Every profile tab refetches the WHOLE person
  payload (academics + finance + documents roll-ups) to render one section.
  Per-section endpoints, or passing the layout's copy down, would cut both the
  payload and the TTFB.
- *The sidebar has the same lag.* Its active state is pathname-driven too, so
  it waits for the commit exactly as the tabs did. The same optimistic
  treatment would apply.

---

## Pass 5 — the body, not just the tab

Pass 4 moved the tab strip on click but left the BODY showing the previous
tab's content until the router committed — so the strip said "Finance" while
Overview was still on screen. The strip lied, which is worse than the lag.

**Why `loading.tsx` can never fix this.** The boundary is there and looks like
it should work. But React wraps navigation in a transition, and during a
transition, content that suspends inside a Suspense boundary which has ALREADY
been revealed does not re-show that boundary's fallback — React keeps the
previous UI deliberately, to avoid flashing a skeleton over something the
reader is already reading. The profile's boundary was revealed when the profile
first loaded, so every tab change afterwards is exactly that case. No amount of
boundary work reaches it.

So the loading state has to come from us, on click, not from the router, on
commit. `profile-nav.tsx` holds one pending tab that the strip and the body
both read: the strip moves the selection, the body swaps to
`DetailBodySkeleton`. The pathname stays the authority — on commit, failure,
Back, or a 10s timeout, the pending state is dropped.

| | Before pass 4 | After pass 5 |
| --- | --- | --- |
| Tab visibly moves | 518 ms | **61 ms** |
| Body shows the incoming tab's skeleton | never (old content until commit) | **61 ms** |
| Router commits | 518 ms | 385 ms |

### Duplicate calls — what they actually were

Measured on Overview: `/api/directory/people/{id}/account` fetched **twice**,
~3 s each. Two independent causes, both real:

1. **Two panels fetch the same endpoint.** `AccountAccessPanel` and
   `AccessScopePanel` each call `/account` on their own. That is the genuine
   redundancy, and it is still open — they should share one fetch.
2. **Dev StrictMode double-invokes effects.** `reactStrictMode` is unset, which
   means Next defaults it to true in development. Two panels x two invocations
   is the "4 calls" that prompted this. Production invokes once.

### Cancellation, now wired

All four profile panels ran `useEffect(() => { void load(); }, [load])` with no
cleanup and no `AbortController` — so leaving a tab left a multi-second request
holding a connection and then calling `setState` into an unmounted panel. Each
now keeps its in-flight controller in a ref: a newer load aborts the older one,
and the effect's cleanup aborts on unmount. `load()`'s signature is unchanged,
so the refresh call sites (`onDone={load}`, retry buttons) still work.

This is worth doing on its own merits, but be clear about what it does NOT do:
it never made navigation faster, because only one RSC request is ever in
flight and nothing was queued behind the panel calls.

**Honest limit:** the abort wiring typechecks and is structurally correct, but
I could not get the browser to observe an abort actually firing — returning to
Overview client-side never re-triggered the panel fetches (the router cache
serves the payload), so there was nothing in flight to cancel. Unverified
empirically.

---

## Pass 6 — one loader per wait, not two

Pass 5 left a visible seam: a generic placeholder appeared on click, then a
*differently shaped* one replaced it mid-wait, which read as a glitch rather
than as loading. Measured on a tab switch:

| At | What was on screen |
| --- | --- |
| 48 ms | `ProfileBody` pending — 3 regions, 710 px (stat row + 2 blocks) |
| 469 ms | router commits, pending clears, `loading.tsx` takes over — 4 regions, 762 px (3 blocks, no stat row) |
| 756 ms | content |

Two different components were drawing the placeholder for two halves of the
same wait: `ProfileBody` from the click to the commit, and the segment's
`loading.tsx` from the commit to the body resolving. They disagreed, so the
handover was visible — the skeleton grew a block and the stat row came and
went.

**Fix: one definition.** `profile-tab-skeleton.tsx` owns the shape, keyed by
tab, and both render it — `ProfileBody` for the tab the reader ASKED for,
`loading.tsx` for the tab the URL now names. They are the same tab, so the
handover draws the same thing and cannot be seen. `loading.tsx` became a client
component to read the pathname, which is what lets it name that tab.

Each tab's shape now mirrors what it actually renders: stat row + one list for
Academics and Finance, two list blocks for People and Documents, four sections
for the long Overview.

| | Before | After |
| --- | --- | --- |
| Distinct loading phases | 3 | **2** (skeleton → content) |
| First paint | 48 ms | **11–30 ms** |

---

## Pass 7 — a skeleton must be replaced by CONTENT, never by another skeleton

Pass 6 made the two route-level placeholders agree. It did not touch the layer
below: a tab body whose panels fetch on mount replaces the route skeleton with
the PANELS' skeletons — smaller, differently shaped, and arriving hundreds of
milliseconds apart. Measured:

**People tab, before** — the page promised a body, then collapsed to a seventh
of its height, then grew back:

| At | On screen |
| --- | --- |
| 46 ms | route skeleton, 500 px |
| 730 ms | Guardianship panel's own skeleton, **72 px** |
| 1247 ms | content |

**Overview, before** — worse, four phases:

| At | On screen |
| --- | --- |
| 35 ms | route skeleton, 1024 px |
| 917 ms | two panel skeletons, 64 px + 96 px |
| 2177 ms | one panel skeleton, 96 px |
| 2968 ms | content |

**The rule this exposed:** a route's skeleton stands in for the whole body, so
the body must be able to render in full when it arrives. A panel that fetches
its own first load breaks that promise — it turns one wait into two, and the
second one is a different size.

**Fix: the server resolves the first load; the panel owns only refreshes.**
Each panel now takes optional initial data. When seeded, its mount effect does
not fetch and `loading` starts false; its own mutations still call `load()`.
The page keys each panel by person, so moving between people remounts it.

- People tab → guardianships fetched in `people/page.tsx`.
- Overview → `/account` fetched ONCE in `page.tsx` and handed to both
  `AccountAccessPanel` and `AccessScopePanel`, plus grants / campuses / roles.
  That also closes the duplicate-call finding from pass 5: the two panels were
  each fetching `/account` independently.

| | Before | After |
| --- | --- | --- |
| People tab phases | 3 | **2** |
| Overview phases | 4 | **2** |
| Overview client API calls during a tab switch | **7** (4 of them duplicate `/account`) | **0** |

**Still client-fetched on mount elsewhere.** `StaffEmploymentPanel` (Overview,
staff only — not exercised by the student profile measured here) and the panels
on other workbenches follow the old shape. The same seeding applies; they were
out of scope for this pass.

---

## Pass 8 — the rest of the first-load owners

Pass 7 fixed the two panels the eye caught. This swept for the rest: every
client component that owns its own first load while sitting under a route that
already paints a skeleton. Gate: `node scripts/audit-first-load-owners.mjs`.

**Seeded from the server (the defect):**

| Component | Route | Data now resolved server-side |
| --- | --- | --- |
| `StaffEmploymentPanel` | `/people/[id]` | `/directory/people/{id}/employment` |
| `StatusClient` | `/status/[token]` (public portal) | `/public/admissions/status/{token}` |

With the pass-7 work, a staff profile now makes **zero** client API calls on
load — account, access grants and employment all arrive with the page.

**Accepted, with the reason recorded in the script (13):**

- *Drawers and modals* — `step-up-prompt`, the person drawer, the admissions
  drawer. Opened by an explicit action, and a drawer IS its own surface: it
  never stands behind a route skeleton, so its spinner is the only loader the
  reader sees.
- *Interaction-gated fetches* — `household-detail-client`, `audit-client`,
  `roles-manager`. All three receive their content as props; every fetch in
  them is behind `if (open)` or a selected row, so none is a first load. These
  looked like offenders to the heuristic and are not.
- *The two SWR dashboards* — `parent-dashboard`, `platform-dashboard` on
  `/overview`. That page is itself a client component, so there is no server
  render to seed from. Measured before accepting: the dashboard shell paints
  immediately and only the card interiors fill in — **page height stays
  constant at 814 px throughout**, so there is no collapse and no glitch. This
  is ordinary progressive loading in a stable layout, and converting the page
  to a server component would buy nothing visible.

---

## Pass 9 — the sidebar

The last surface still driven purely by `usePathname()`, and so the last one
that stayed highlighted on the page you were leaving for the whole round trip.

One state in `app-chrome.tsx` fixes the entire chrome at once, because
`useResolvedNavigation` derives the active item, the open section AND the
breadcrumb from a single path: record the href on click, feed
`pendingHref ?? pathname` to the resolver, and hand authority back to the URL
on commit (or after 10s, so a failed navigation never strands the rail
pointing somewhere the reader never reached).

Every nav surface — rail, flyout, mobile bar, drawer — funnels through the one
`navigate` callback, so none of them needed touching individually.

| Navigation | Rail moves | URL commits | Ahead by |
| --- | --- | --- | --- |
| Health → People | **70 ms** | 599 ms | 529 ms |
| People → Events | **56 ms** | 1895 ms | 1839 ms |

That closes the follow-up left open in pass 4. The three optimistic surfaces
now share one pattern: **record the intent on click, render from it, and let
the URL confirm or correct it.** Profile tab strip (pass 4), profile tab body
(pass 5), sidebar (pass 9).

---

## Pass 10 — the app body, not just the rail

Pass 9 made the sidebar move on click. The BODY did not: `children` is still
the page being left until the router commits, so the chrome and the content
disagreed about where the reader was. Measured on
`/students/admissions → /people`:

| At | On screen |
| --- | --- |
| 0 ms | click |
| 10527 ms | still the ADMISSIONS page, then URL + skeleton appear together |

The same optimistic treatment the profile body got in pass 5, applied at the
app shell: while a navigation is in flight, `AppChrome` renders a placeholder
instead of the outgoing page.

| | Before | After |
| --- | --- | --- |
| Old page clears | at commit (0.6 s–10 s) | **~70 ms** |

**Two hypotheses measured and rejected** — recorded so nobody retries them:

- *Moving the page's `await` into a `<Suspense>`-wrapped child* so the shell
  could flush first. Time-to-first-byte unchanged (229/207 ms streaming vs
  187/267 ms blocking). Reverted.
- *Wrapping `router.push` in `startTransition` and rendering on `isPending`*,
  hoping it would stay true until the new tree was ready. It ends at the
  commit, exactly like the pathname, so the destination's own `loading.tsx`
  still took over afterwards. Kept (it is the more accurate signal of "a
  navigation is happening") but it did not fix the handover.

**The handover, and where it now stands.** After the commit the destination's
own `loading.tsx` takes over for ~0.3–0.7 s before content. That cannot be
avoided from the client — the placeholder cannot know the destination's
silhouette without duplicating every route's skeleton into a lookup. What it
CAN do is not change size at the handover, so `PageChangeSkeleton` is one flat
busy region — header bar plus a slab that fills the content area — rather than
a composed stat-row-and-cards:

| | Placeholder | Route skeleton |
| --- | --- | --- |
| Before | bars=3, **h=332** | bars=62, **h=814** |
| After | bars=3, **h=814** | bars=62, **h=814** |

Detail fills in within a fixed frame instead of the page growing. Some
navigations (Events, Library) show no handover at all.

---

## Not yet assessed — the next pass

The audit above proves every route paints *something* immediately. It does
**not** yet prove the skeleton is the right *shape*. Two open items:

1. **The 16 inheriting routes.** Covered against a dead click, but each paints
   its parent's silhouette rather than its own. Known instance: `/people/[id]`
   is entered through an async layout whose nearest boundary is the **people
   directory** skeleton — a table shape standing in for a profile. Correct
   behaviour, wrong shape.

2. **Spinner-based waits (13 files).** Drawers and dialogs that show a
   centred `Loader2` while their content loads — the person drawer, the
   admissions drawer, household detail, ledger, payments, take-assessment. A
   spinner in a drawer that has not painted yet is defensible: there is no
   content shape to hold, and the drawer itself is the loading affordance. Left
   deliberately, but worth revisiting if any of them feel slow in use.

Neither is a blocked click, which is why they sit behind the findings above.

---

## Notes for whoever picks this up

- The nav rail already prefetches on `pointerenter` / `pointerdown` / `focus`
  (`app-chrome.tsx` → `router.prefetch`), so a hovered destination is usually
  warm. Note Next disables prefetch in dev, so **dev navigation is materially
  slower than production** — do not tune against dev timings.
- Nav items are `<button>` + `router.push`, not `<a href>`. That costs
  middle-click / cmd-click / "open in new tab" and is worth revisiting, but it
  is an affordance gap, not a latency one.
