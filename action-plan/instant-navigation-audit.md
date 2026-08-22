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

## Pass 11 — scoping the placeholder to what actually changes

Pass 10's placeholder replaced EVERYTHING below the app shell whenever a
navigation was in flight. That is right when the whole page changes and wrong
when the destination sits inside chrome that is already on screen and is not
going anywhere.

`lib/navigation/nav-pending.tsx` defines a **chrome scope** — a path prefix
whose layout survives navigation within it. If a navigation stays inside one,
the app shell stands down and that scope's layout swaps only its own body.
Cross-scope navigation has no alternative: the destination's layout is not
mounted yet, so only the shell can hold the placeholder.

Which layouts actually render persistent furniture (rather than being
permission gates that `return <>{children}</>`):

| Layout | Verdict |
| --- | --- |
| `(app)/settings/layout.tsx` | **Was being wiped** — it is all over the sidebar config, so section-to-section clicks go through `navigate()`. Now scoped. |
| `(app)/people/[id]/layout.tsx` | Already correct — `ProfileBody`, pass 5. |
| `(app)/account/layout.tsx` | **No bug.** Its section links are `<Link>`, so `navigate()` never fires and the shell placeholder never ran there. Claimed as broken before checking; it was not. |

Settings also needed its heading to move optimistically, or the frame would
name the section being LEFT while the body below it loaded the next one — the
same contradiction the profile's tab strip had.

| At | Header | Body |
| --- | --- | --- |
| 49–72 ms | already the destination ("Users", "Audit log") | skeleton |
| ~1.8 s | unchanged | content |

### The registry attempt, and why it was reverted

Option B was to have the shell render the DESTINATION's own `loading.tsx`, so
the click placeholder and the route boundary are the same component and the
handover is invisible. Implemented as a registry that imports each route's
loading module.

**It broke the whole app.** Some `loading.tsx` files are SERVER components that
reach `lib/session.ts`, which imports `next/headers`. Importing them from a
`'use client'` registry dragged server-only code into the client graph and
every route failed to compile. Reverted; the app was restored and re-verified
in the browser.

The lesson is a constraint on the design, not a detail: **a client-side click
placeholder cannot reuse route `loading.tsx` modules**, because those are free
to be server components. Any future attempt has to define the shapes in a
client-safe module of its own — which reintroduces the duplication option B
existed to avoid, and would need an audit to keep the copy honest.

---

## Pass 12 — the generic placeholder is gone

The click placeholder now paints the DESTINATION's own shape, so the
tailored skeleton is the only one a reader ever sees.

**Why it is a copy.** The obvious design — have the shell render the route's
own `loading.tsx` — is impossible: those files may be server components, and
several are (`overview` reads the session; others reach `lib/session`, which
imports `next/headers`). Importing them from a client module broke the entire
app in pass 11. So `lib/navigation/route-skeletons.tsx` re-declares the shapes
in a client-safe module, and `scripts/audit-route-skeletons.mjs` fails when it
and a route's real `loading.tsx` disagree. The duplication is real; the gate is
what keeps it honest — verified by tampering with a route's shape and watching
the audit name both sides and exit 1.

**Three mechanisms, one silhouette.** A navigation crosses three renderers, and
all three now resolve the same shape:

| Renderer | Knows the destination how |
| --- | --- |
| `app-chrome` click placeholder | the pending href |
| `(app)/loading.tsx` (section layout's await) | the pathname — the URL has committed by then |
| the route's own `loading.tsx` | it *is* the route |

Missing the middle one is what produced a `62 → 3 → 62` bar flicker on the
first attempt: the app boundary was still generic.

**Measured, one phase throughout:**

| Navigation | Placeholder | To content |
| --- | --- | --- |
| → Events | `bars=62` at 145 ms | 2422 ms |
| → Health | `bars=74` at 113 ms | 6772 ms |
| → Gradebook standing | `bars=62` at 203 ms | 12081 ms (cold dev compile) |
| Settings → Audit log | `bars=53`, header already "Audit log", at 199 ms | 3919 ms |
| Settings → Roles | `bars=36`, header already correct, at 113 ms | 12983 ms |

`PageChangeSkeleton` survives only for a destination outside the nav config.

---

## Pass 13 — production prefetch, measured at last

Every number in passes 1–12 was dev-measured, with the standing caveat that
Next disables prefetch in `next dev`. Built the app for real and measured it.

**Method.** Built `HEAD` in a detached git worktree under the scratchpad —
never in the working tree, because `next build` alongside a live `next dev`
corrupts `.next`. Served on :3031, the API left on the owner's :3030. Cookies
are not port-scoped, so the browser session carried over. Same destination
measured twice with a reload between (to clear the router cache): once clicked
cold, once after a 1.5s hover so `router.prefetch()` could land.

| Destination | No hover — URL / content | Hovered first — URL / content |
| --- | --- | --- |
| `/events/upcoming` | 999 ms / 1922 ms | **54 ms / 54 ms** |
| `/health/records` | 134 ms / 434 ms | **56 ms / 56 ms** |

**Prefetch is decisive.** A hovered destination commits and paints in ~55 ms —
no perceptible wait, and the placeholder never appears at all.

**And dev was lying about the scale.** `/health/records` took 6772 ms to
content in dev and 434 ms in production without any prefetch. Roughly 15x, and
it was Turbopack compiling on demand, not the app.

**Profile tabs, production:**

| | dev | production |
| --- | --- | --- |
| URL commits | 385–520 ms | **32–35 ms** |
| Skeleton appears | ~60 ms | 20 ms |
| Content | ~1.2 s | ~460–500 ms |

One phase throughout; the ~460 ms to content is real data time (the API round
trip plus the ~123 KB payload), which is exactly the window the skeleton is
meant to cover.

### What this means for passes 4–12

The optimistic and registry work is **not** made redundant, but its value
concentrates where prefetch cannot reach:

- **Touch devices have no hover at all.** Prefetch fires on `pointerdown`, so a
  tap is always the cold path — the 134–999 ms column, not the 55 ms one.
- **Keyboard navigation** prefetches on focus, but a fast tab-and-enter beats it.
- **A reader who clicks without dwelling** gets the cold path.
- **These are localhost numbers**, so network latency is ~0. Over a real
  connection the cold column stretches and the placeholder matters more, not
  less.

The honest summary: for a hovered mouse click in production the placeholder is
never seen, and for every other input path it is what stands between the reader
and a frozen page.

**Left un-measured:** the ~123 KB-per-tab payload is still the largest lever on
the *content* time that remains (~460 ms), and is untouched.

---

## Pass 14 — the payload, and a correction

**The "~123 KB per tab" figure quoted in passes 4–13 was wrong.** It came from
fetching a route's RSC URL directly, which returns the WHOLE tree and, in dev,
includes serialisation artefacts — the single largest line was 12 KB of
`ReadableStream` source code. A real client navigation transfers only the
changed segments. Measured properly:

| | Person JSON | Real navigation (dev) | Real navigation (prod) |
| --- | --- | --- | --- |
| | **2.1 KB** | 16.3 KB | 2.6–4.1 KB |

So the premise — "every tab refetches ~123 KB of person data" — did not hold.
The person payload is 2.1 KB and the tabs were already cheap.

### But the measurement did surface a real regression — mine

Production, per-tab navigation transfer:

| Tab | Wire | Decoded |
| --- | --- | --- |
| Finance | 4.1 KB | 11.3 KB |
| Academics | 2.6 KB | 8.4 KB |
| **Overview** | **131.9 KB** | **759.6 KB** |

One tab, two orders of magnitude out. The cause was pass 7: server-seeding
`AccessScopePanel` passed `/roles` straight through as a prop, and that endpoint
answers with every role's FULL permission list — ~192 keys apiece, ten roles,
**1916 permission strings** serialised into the page.

Typing the fetch as `Role[]` does not prevent it. TypeScript is structural: the
declared type had `{ id, name }`, the runtime object arrived whole, and
everything crossing into a client component is serialised.

**Fix:** project to the fields the panel renders before handing them over.

| | Before | After |
| --- | --- | --- |
| Overview navigation, wire | 131.9 KB | **4.8 KB** |
| Overview navigation, decoded | 759.6 KB | **13.8 KB** |
| Permission strings in payload | 1916 | 341 |

27x smaller on the wire, 55x decoded. The 341 that remain are the viewer's own
session permissions, which the client genuinely needs. Verified the panel still
works: the grants list renders `ROLE: Student`, so `roleName()` still resolves.

**The general rule this is an instance of:** a server component handing data to
a client component is a wire boundary. Project to what is rendered; do not pass
an API response through because its declared type looks narrow.

---

## Pass 15 — the numbers inside the skeleton

Passes 2 and 12 got the right skeleton FAMILY onto every route and made the
click paint it. They never checked the numbers inside it. A table page painting
a table is not enough if it paints five columns where the page has eight, or no
summary cards where the page shows four — the placeholder then rearranges
itself into the content instead of being replaced by it, which is what a reader
actually notices.

**Ground truth is the page's own source:** the `items` array on its `StatGrid`,
the `columns` array on its `DirectoryTable` (falling back to `<TableHead>` count
for hand-rolled tables), and the controls in its `PageHeader actions`.

Two analyser bugs were caught by spot-checking before anything was changed, and
both would have written wrong numbers into 30+ files:

- Counting every element inside `actions` made `/classes/review` look like it
  had **8** buttons. It has one `<Select>`. Controls are counted at depth 0.
- Toolbar filter ids (`users-search`) sit alongside column ids; the column
  count must come from the `columns` array, not from every `id:` in the file.

**37 skeletons corrected across 54 measurable routes.** A sample:

| Route | Was | Now |
| --- | --- | --- |
| `/attendance/daily` | 6 columns | **3** (Pupil / Status / Attendance) |
| `/finance/invoices` | 4 stats, 6 columns | **5 stats, 8 columns** |
| `/finance/ledger` | no stats, default columns | **4 stats, 5 columns, 1 action** |
| `/finance/payments` | no stats | **3 stats** |
| `/events/upcoming` | 3 stats, 5 columns, 2 actions | **4 stats, 6 columns, 1 action** |
| `/settings/roles` | 4 columns | **3** |
| `/finance/approvals` | 6 columns | **8** |

Regenerating the click-placeholder registry was NOT optional afterwards, and
the pass-12 gate proved its worth: it failed immediately with **40 drifted
entries**, naming both sides of each.

**Sixth gate: `scripts/audit-skeleton-fidelity.mjs`.** Compares each skeleton's
`stats` / `actions` / `columns` against the page's real structure and fails on a
mismatch. Verified it bites by setting `/settings/users` to nine columns and
watching it report `skeleton 9, page 4` and exit 1.

### Verified against the rendered pages

Swept 30 routes on a production build with a live session, reading each page's
actual DOM — `[data-slot="stat-grid"]` children, `[data-slot="page-header-actions"]`
children, `thead th` count — and comparing to the skeleton.

**26 of 30 matched. Four did not, and rendered was right in every case:**

| Route | Source said | Rendered | Why source was wrong |
| --- | --- | --- | --- |
| `/people` | no stats, 6 columns | **6 stats, 4 columns** | tiles are computed from `PEOPLE_TYPES` filtered by permission, not a literal array |
| `/finance/ledger` | 5 columns, 1 action | **9 columns, 2 actions** | its column defs carry no `id:` keys, and `DirectoryTable` adds its own header cells |
| `/finance/households` | 1 action | **2 actions** | — |
| `/classes/review` | 1 action | **2 actions** | source sees only the `<Select>` |

`/people` was the notable one: a flagship page showing **six** summary tiles was
painting none.

The lesson is that source is a good first pass but not the authority — a
rendered page includes chrome the source never mentions (`DirectoryTable`'s
select column) and counts that only exist at runtime (permission-filtered
tiles). Those four are now recorded in the fidelity audit's `ACCEPTED` map with
their rendered evidence, so the gate does not fight them.

**Dev is unusable for a sweep like this:** 9 routes in six minutes, because it
compiles each on first request. The same sweep on a production build did 46 in
seconds.

### Completing the sweep — the remaining routes and the dynamic ones

The first sweep stalled on heavy pages because a single slow route blocked its
worker. Adding a 15s `AbortController` per route fixed that: **38 routes
completed, zero errors.** Dynamic routes were resolved to real records by
querying the API for a person, invoice, household, event and application id.

Of those 38, **11 had measurable structure** (the rest are forms and settings
panes with no stat grid, header actions or table). **7 matched; 4 did not:**

| Route | Was | Rendered |
| --- | --- | --- |
| `/students/admissions` | no stats | **4 stats** |
| `/students/fees` | 3 stats | **4 stats** |
| `/students/directory` | 6 columns | **7** |
| `/finance/households/[id]` | 2 actions | **1** |

Same pattern as before: stat tiles computed at runtime, and `DirectoryTable`
adding header cells the column definitions do not mention.

**Coverage now:** 41 routes verified against their rendered page, all with a
skeleton matching what the page draws. Two dynamic routes remain unverified —
`/platform/tenants/[id]` and `/classes/assessments/take/[id]` — because the
signed-in persona is school-scoped and cannot reach a platform tenant or an
assessment offering. They keep their source-derived shapes.

**Running total across passes 15: 45 skeletons corrected** (37 from source,
4 + 4 from rendering).

---

## Pass 16 — tables that hold their height

Paging a directory moved everything below it: a last page with three rows was
three rows tall, so going back to a full page shifted the pager, the footer and
the scroll position.

**Page size was already 10** — `DEFAULT_PAGE_SIZE` and
`DEFAULT_DIRECTORY_STATE.pageSize` both were, and no table overrode it. Nothing
to change there; the jump came entirely from short pages.

`DirectoryTable` now pads a short page out to the page size with blank rows.
They are `aria-hidden`, carry no id, no selection and no click target, so they
are presentational only and never reach the row count a screen reader
announces. An EMPTY result set is left alone: it swaps the whole table for the
empty state, and padding would bury the message under ten blank rows.

**Padding has to match a real row's height**, which is the part a naive
implementation gets wrong: a blank row is one line tall, while a real one may
carry an avatar or two lines of text, so short padding still leaves a short
page short. Rows in a table are uniform, so the first is measured in a LAYOUT
effect — before paint, so the padding is never briefly the wrong size — and
that height is applied to the fillers. In jsdom (and before layout) the
measurement reads 0, so the CSS line box stays in charge rather than pinning
rows to nothing.

**All 38 table skeletons moved to `rows={10}`** to match, or the handover from
placeholder to content would introduce the very jump this removes.

Three tests cover it: a short page pads to the page size with the right number
of `aria-hidden` rows, a full page is not padded, and an empty result set shows
the empty state with no padding.

**Not verified by eye:** both browser sessions expired to `/login` again, so
this is covered by tests and the gates, not by looking at it.

---

## Pass 17 — one row height, one tile height, one page size

Three things that all cause the same thing: content changing size between the
placeholder and the page, or between one page of a table and the next.

**Page size — nine pages were opting out.** `DEFAULT_PAGE_SIZE` is 10, but nine
route files declared their OWN `const DEFAULT_PAGE_SIZE` (eight at 25, one at
50). Because the local constant had the same name, the shadowing was invisible
at the call site — `defaultPageSize: DEFAULT_PAGE_SIZE` looked correct in every
one. All nine now import the shared constant, and
`scripts/audit-page-size.mjs` (a seventh gate) fails on any file that declares
its own. Verified it bites.

**Row height — the skeleton and the table never agreed.** A real cell is `p-2`,
so a single-line row is ~37px and one with an avatar ~52px; the skeleton row
was `py-3.5`, ~42px. Whatever the content, the handover moved. Both now take
their height from one token, `--table-row-h`, defined next to the other layout
tokens in `globals.css` and applied to the real `TableCell`, the skeleton's
rows, the standalone `SkeletonTable`, and the blank rows that pad a short page.
Sized to clear an avatar cell so a row never has to grow.

**Stat tiles — a conditional footnote made a ragged row.** Only some tiles carry
a delta or hint, and the line was rendered only when present, so a row of tiles
sat at two heights and the placeholder — which never drew that line — was
shorter than either. The line is now ALWAYS laid out (empty when there is
nothing to say) and the skeleton draws it too. Costs one line of whitespace on
tiles without a footnote; buys a row that does not reflow when data lands.

### Still open, and why

- ~~`/classes/gradebook` has no pagination at all.~~ **Done** — converted to
  `DirectoryTable` (see below).
- ~~`/classes/materials` and `/classes/assessments` skeletons still mismatch.~~
  **Done** — see pass 20.

---

## Pass 18 — the gradebook becomes a governed table

`/classes/gradebook` was the one page the row-padding and 10-row work could not
reach, because it was not a governed table at all: a server component rendering
a hand-rolled `<Table>` of every row it had fetched. No pager, no page size, no
padding — and nothing stopping a busy term from printing a thousand rows.

Converted to `DirectoryTable` on the in-memory pattern the event roster already
uses (`filtered.slice(...)` client-side), because the grades API is per
assessment and cannot paginate across them server-side.

The page keeps its data assembly and its header; the table moved to
`gradebook-client.tsx`, which adds:

- search across student, student number and assessment
- Class and Grade filters, built from the rows actually present
- sortable Student / Assessment / Percent
- the standard pager at the shared 10-row default, with the blank-row padding

One judgement worth recording: sorting by percent puts **ungraded rows last in
both directions**. A missing score is not a zero, and letting it sort as one
would put every unmarked pupil at the top of an ascending sort.

Its skeleton (`rows={10} columns={6} actions={1}`) already matched the new
shape, and the fidelity audit confirms it.

**Not verified by eye** — the browser session had expired again.

---

## Pass 19 — the token that wasn't there

Pass 17 gave the real row and the skeleton row a shared height token and
removed the skeleton's `py-3.5` padding in favour of it. Looking at the running
app showed the result:

| | Height |
| --- | --- |
| Real table row | 49 px |
| Skeleton row | **15 px** |

`--table-row-h` was resolving to nothing, so `min-h-[var(--table-row-h)]`
contributed no height — and because the padding it replaced was gone, skeleton
rows collapsed to bare bar height. A table placeholder rendered as a stack of
thin lines. Strictly worse than before the "fix": the old `py-3.5` was ~42px
against a ~49px row.

The token is defined in the right `:root`, in a stylesheet the app does import
— `--font-scale` from four lines above it resolves fine. It simply had not
recompiled, and a reload did not clear it. That is the whole lesson:

> **A design token is only as available as the stylesheet that defines it.**
> A `var()` with no fallback turns a stale cache into a layout collapse.

Every use now carries the literal: `var(--table-row-h, 3.25rem)`. Measured
after:

| | Before | After |
| --- | --- | --- |
| Skeleton row | 15 px | **52 px** |
| Real row | 49 px | **53 px** |
| Filler row | 49 px | **53 px** |

One pixel apart, so the handover no longer moves.

**Worth knowing:** the dev server is still serving CSS without the token. The
fallback makes that invisible, but a dev restart is what actually clears it —
see the Turbopack CSS-cache note in the repo's gotchas.

---

## Pass 20 — two skeletons chosen by looking, not reading

With a session in hand, both pages were opened and measured rather than
inferred from source. Source had said "there is a `<Table>` in here somewhere";
the DOM said something else entirely.

**`/classes/materials`** — `0` tables. A class picker, then a lessons list
beside a lesson EDITOR (title, summary, notes). It was painting a ten-row data
table with a toolbar: the wrong family, not just the wrong numbers.

**`/classes/assessments`** — renders `data-slot="list-detail-layout"` outright,
so the panes were already right. What was missing sat above them: a subject
picker and a search, so the placeholder stood a whole control-row short.

Neither could be expressed by the existing `ListDetailPageSkeleton`, which had
no notion of a control row and always drew a stats-style detail pane. It gained
two options, both named for what they are:

- `filters` — the picker/search row these pages choose their subject with.
  Part of the silhouette, not decoration.
- `detail: 'summary' | 'form'` — a read-out with figures, or an editor. Lesson
  materials opens straight into a form, where stat tiles are simply not what
  arrives.

Set from the pages' own measured counts: materials `actions={0} filters={1}
listRows={6} detail="form"`, assessments `actions={1} filters={2} listRows={6}`.

Verified in the browser: the materials placeholder now captures as a two-pane
list/detail with no table grids at all.

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
