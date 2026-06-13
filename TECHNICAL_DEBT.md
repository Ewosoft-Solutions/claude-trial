# Technical Debt

## Pending

### TD-002

Issue:
Notification service not implemented.

Notes:
This is an unbuilt feature rather than cleanup of existing code — there is no
stub or partial implementation to finish. Remaining `notification` references in
the codebase (e.g. shell user-menu items, `breach-response.service.ts`,
`profile-suspension.service.ts`, seed data) are incidental and do not depend on
a central service. Deferred until the feature is specced.

Priority:
Low

---

## Resolved

### TD-001 (resolved 2026-06-13)

Issue:
Sidebar navigation still contains placeholder data.

Resolution:
The productized Aurora shell sidebar
(`packages/ui/src/custom/shell/app-sidebar.tsx`) is fully data-driven and was
already satisfying the requirement. The legacy shadcn template components have
now been deleted, since they embedded template data and were not imported by
`apps/web` (only by each other):
`packages/ui/src/custom/app-sidebar.tsx`, `nav-main.tsx`, `nav-projects.tsx`,
`nav-user.tsx`, and `team-switcher.tsx`. `sidebar-toggle.tsx` was removed in the
same pass — it was imported only by the legacy `app-sidebar.tsx` and became dead
code once that was gone. The new shell set under `custom/shell/` is unaffected.

---

### TD-003 (resolved 2026-06-13)

Issue:
`ModeToggle` (packages/ui/src/custom/mode-toggle.tsx) had hardcoded debug
styling on its trigger button (`text-primary bg-destructive`).

Resolution:
Removed the `text-primary bg-destructive` override so the trigger uses the
standard `outline` button variant. Verified in the design-system preview: the
trigger now renders with the neutral `bg-background` surface (no red), no
console errors.

---

### TD-004 (resolved 2026-06-13)

Issue:
Root `package.json` still declared `pnpm.overrides` (glob, rimraf, inflight,
lodash.get, @types/minimatch). pnpm 10.4.1 no longer reads the `pnpm` field from
package.json, so these overrides were silently ignored (and it warned on every
install).

Resolution:
Deleted the dead `pnpm` field from `package.json` (removes the per-install
warning). The five overrides were **not** migrated to `pnpm-workspace.yaml` —
on inspection they are obsolete rather than worth preserving:

- `glob: ^11.0.0` and `rimraf: ^5.0.0` were upward pins for old transitive
  versions. The current graph already resolves `glob@13.0.6` and `rimraf@6.1.3`,
  so activating these pins would *downgrade* modern deps.
- `lodash.get` and `@types/minimatch` are no longer in the dependency graph at
  all, so their overrides are no-ops.
- `inflight: npm:@jsdevtools/inflight@^1.0.6` (swap the abandoned memory-leaking
  `inflight` for a maintained fork) is the only one with residual value. It was
  left out to keep this change behavior-preserving (the original TD explicitly
  wanted to avoid changing dependency resolution). It can be added back as a
  scoped, separately-verified change if desired.

Note: the committed `pnpm-lock.yaml` is still on the legacy `lockfileVersion 5.4`
(pnpm 6 era) while the repo uses pnpm 10.4.1; a `pnpm install` regenerates it to
`9.0`. Regenerating/committing that lockfile is a separate cleanup, intentionally
not bundled here.
