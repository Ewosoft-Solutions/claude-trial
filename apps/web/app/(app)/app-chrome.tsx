'use client';

/* ============================================================
   AppChrome — the live Aurora shell

   Wires the M4 navigation model to the REAL session + router:
     • ViewerContext  ← useViewer() (the auth/session seam)
     • current route  ← usePathname()
     • navigation     ← router.push() via useResolvedNavigation

   This replaces the design-system shell preview's simulated in-page
   route + persona switcher. The shell components still receive only
   resolved RailItem[] / NavGroup[] — no roles or tenant logic.
   ============================================================ */

import * as React from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { PageChangeSkeleton } from '@workspace/ui/custom/states/page-skeletons';
import {
  Bell,
  Fingerprint,
  LogOut,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { AppShell } from '@workspace/ui/custom/shell/app-shell';
import { AppHeader, OmniSearch } from '@workspace/ui/custom/shell/app-header';
import { AppSidebar } from '@workspace/ui/custom/shell/app-sidebar';
import { MobileNav } from '@workspace/ui/custom/shell/mobile-nav';
import { MobileRail } from '@workspace/ui/custom/shell/mobile-rail';
import { SchoolSwitcher } from '@workspace/ui/custom/shell/school-switcher';
import { AppBreadcrumbs } from '@workspace/ui/custom/shell/app-breadcrumbs';
import { CountBadge } from '@workspace/ui/custom/data-display/count-badge';
import { useResolvedNavigation } from '@workspace/ui/hooks/use-navigation';
import { findActiveNavItem } from '@workspace/ui/lib/navigation';
import type {
  BreadcrumbEntry,
  UserMenuItem,
} from '@workspace/ui/types/shell.types';

import { useMobileNavMode } from '@/app/providers/mobile-nav-provider';
import { useViewer } from '@/app/providers/viewer-provider';
import { configForViewer } from '@/lib/navigation/app-navigation';
import { useNavCounts } from '@/lib/navigation/use-nav-counts';
import {
  claimMissingPasskeyIntent,
  clearBiometricReminderIntent,
  clearBiometricReminderPreference,
  clearRequiredEnrollmentPromptDismissal,
  dismissRequiredEnrollmentPrompt,
  hasDismissedRequiredEnrollmentPrompt,
  isBiometricReminderFocusRoute,
  readBiometricReminderPreference,
  shouldShowBiometricReminder,
  snoozeBiometricReminder,
  suppressBiometricReminder,
  type BiometricReminderPreference,
} from '@/lib/biometric-reminder';
import { writeSidebarPreference } from '@/lib/sidebar-preference';
import {
  useResumableModal,
  useSessionLifecycle,
} from '@/app/providers/session-lifecycle-provider';
import { BiometricEnrollmentBanner } from './_shared/biometric-enrollment-banner';

const AiWorkspaceLauncher = dynamic(
  () => import('./_shared/ai-workspace').then((mod) => mod.AiWorkspaceLauncher),
  { ssr: false },
);

const GlobalSearch = dynamic(
  () => import('./_shared/global-search').then((mod) => mod.GlobalSearch),
  { ssr: false },
);

const USER_MENU: UserMenuItem[] = [
  {
    key: 'account',
    label: 'Account & preferences',
    icon: <SlidersHorizontal />,
    href: '/account/profile',
  },
  {
    key: 'signout',
    label: 'Sign out',
    icon: <LogOut />,
    destructive: true,
    separatorBefore: true,
  },
];

function HeaderActions({ notifications }: { notifications: number }) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Quick add"
        className="max-lg:hidden"
      >
        <Plus />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={
          notifications > 0
            ? `Notifications, ${notifications} needing attention`
            : 'Notifications'
        }
        className="relative"
      >
        <Bell />
        {/* Rolled-up total of the actionable counts across the viewer's
            accessible sections. CountBadge hides itself at zero. */}
        <CountBadge
          count={notifications}
          size="sm"
          className="pointer-events-none absolute -right-1 -top-1 border-2 border-sidebar"
        />
      </Button>
    </>
  );
}

export function AppChrome({
  children,
  sidebarExpanded = true,
}: {
  children: React.ReactNode;
  /** Initial desktop-rail state from the persisted cookie (no refresh flash). */
  sidebarExpanded?: boolean;
}) {
  const {
    accountId,
    viewer,
    user,
    schools,
    activeSchoolId,
    activeProfileId,
    switchProfile,
    biometricEnrollment,
  } = useViewer();
  const router = useRouter();
  const pathname = usePathname();
  // Below md the user picks their surface: the bottom tab bar + drawer, or the
  // collapsed rail pinned in its place. Exactly one of the two renders.
  const { pinned: mobileRailPinned, setPinned: setMobileRailPinned } =
    useMobileNavMode();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [enrollmentPromptOpen, setEnrollmentPromptOpen] = React.useState(false);
  const [hasEnrollmentIntent, setHasEnrollmentIntent] = React.useState(false);
  const [reminderPreference, setReminderPreference] =
    React.useState<BiometricReminderPreference | null>(null);
  const [switchingForEnrollment, setSwitchingForEnrollment] =
    React.useState(false);
  const requiredPromptShownRef = React.useRef(false);
  const { signOut } = useSessionLifecycle();
  const reopenSearch = React.useCallback(() => setSearchOpen(true), []);
  useResumableModal('global-search', searchOpen, reopenSearch);

  React.useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (
        event.key?.toLowerCase() === 'k' &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  React.useEffect(() => {
    if (biometricEnrollment.enrolled) {
      clearBiometricReminderIntent(accountId);
      clearBiometricReminderPreference(accountId);
      clearRequiredEnrollmentPromptDismissal(accountId);
      setHasEnrollmentIntent(false);
      setReminderPreference(null);
      setEnrollmentPromptOpen(false);
      return;
    }

    setHasEnrollmentIntent(claimMissingPasskeyIntent(accountId));
    setReminderPreference(readBiometricReminderPreference(accountId));
  }, [accountId, biometricEnrollment.enrolled]);

  const focusRoute = isBiometricReminderFocusRoute(pathname);
  const reminderVisible = shouldShowBiometricReminder({
    enrolled: biometricEnrollment.enrolled,
    policy: biometricEnrollment.policy,
    hasIntent: hasEnrollmentIntent,
    preference: reminderPreference,
    focusRoute,
  });
  const enrollmentRequired =
    biometricEnrollment.policy === 'require' && !biometricEnrollment.enrolled;

  React.useEffect(() => {
    if (
      enrollmentRequired &&
      !focusRoute &&
      !hasDismissedRequiredEnrollmentPrompt(accountId) &&
      !requiredPromptShownRef.current
    ) {
      requiredPromptShownRef.current = true;
      setEnrollmentPromptOpen(true);
    }
  }, [accountId, enrollmentRequired, focusRoute]);

  const dismissRequiredPrompt = React.useCallback(() => {
    dismissRequiredEnrollmentPrompt(accountId);
    setEnrollmentPromptOpen(false);
  }, [accountId]);

  // One switcher entry per profile, not per school — a user can hold more
  // than one profile at the same school (e.g. Teacher + Parent), and each
  // is a distinct context to switch into, not a variant of the same one.
  // Keyed by profileId so co-located profiles at one school render as
  // separate rows instead of colliding on the school's tenant id.
  const profileOptions = React.useMemo(
    () =>
      schools.flatMap((school) =>
        (school.profiles ?? []).map((profile) => ({
          id: profile.profileId,
          tenantId: school.id,
          name: school.name,
          initials: school.initials,
          logoUrl: school.logoUrl,
          color: school.color,
          caption: profile.role,
        })),
      ),
    [schools],
  );

  const setupHref = `/account/security?intent=enroll&from=${encodeURIComponent(pathname)}`;
  const requiredContext = biometricEnrollment.requiredBy[0];
  const requiredProfile = requiredContext
    ? profileOptions.find(
        (profile) => profile.tenantId === requiredContext.schoolId,
      )
    : undefined;
  const mustSwitchForEnrollment =
    enrollmentRequired &&
    biometricEnrollment.activePolicy === 'forbid' &&
    requiredProfile !== undefined;

  const startEnrollment = React.useCallback(async () => {
    setEnrollmentPromptOpen(false);
    if (!mustSwitchForEnrollment || !requiredProfile) {
      router.push(setupHref);
      return;
    }

    setSwitchingForEnrollment(true);
    try {
      await switchProfile(
        requiredProfile.tenantId,
        requiredProfile.id,
        setupHref,
      );
    } catch (error) {
      setSwitchingForEnrollment(false);
      console.error('[AppChrome] enrollment context switch failed', error);
    }
  }, [
    mustSwitchForEnrollment,
    requiredProfile,
    router,
    setupHref,
    switchProfile,
  ]);

  const snoozeEnrollmentReminder = React.useCallback(() => {
    snoozeBiometricReminder(accountId);
    setReminderPreference(readBiometricReminderPreference(accountId));
  }, [accountId]);

  const suppressEnrollmentReminder = React.useCallback(() => {
    suppressBiometricReminder(accountId);
    setReminderPreference({ mode: 'never' });
  }, [accountId]);

  const handleProfileChange = React.useCallback(
    (selected: { id: string }) => {
      if (selected.id === activeProfileId) return;
      const option = profileOptions.find((p) => p.id === selected.id);
      if (!option) return;
      switchProfile(option.tenantId, option.id).catch((err) => {
        console.error('[AppChrome] switchProfile failed', err);
      });
    },
    [activeProfileId, profileOptions, switchProfile],
  );

  // The tenant/school context switcher now lives inside the navigation menu
  // (under the brand), so it renders in both the desktop rail and the mobile
  // drawer with the surface's current expanded state. Only school-scoped
  // viewers have a tenant to switch.
  const renderSchoolSwitcher = React.useCallback(
    (switcherExpanded: boolean, menuSide?: 'right' | 'bottom') =>
      viewer.scope === 'school' ? (
        <SchoolSwitcher
          schools={profileOptions}
          activeSchoolId={activeProfileId}
          onSchoolChange={handleProfileChange}
          menuLabel="Schools and roles"
          expanded={switcherExpanded}
          menuSide={menuSide}
        />
      ) : null,
    [viewer.scope, profileOptions, activeProfileId, handleProfileChange],
  );

  const userMenu: UserMenuItem[] = React.useMemo(
    () =>
      USER_MENU.map((item) =>
        item.key === 'signout'
          ? {
              ...item,
              onSelect: async () => {
                await signOut();
              },
            }
          : item.key === 'account'
            ? {
                ...item,
                href: `/account/profile?from=${encodeURIComponent(pathname)}`,
              }
            : item,
      ),
    [pathname, signOut],
  );

  /**
   * Where the reader has ASKED to be, before the router agrees.
   *
   * The App Router does not commit a navigation until the new route's payload
   * arrives — measured elsewhere in this app at ~500ms warm and seconds on a
   * cold route. `usePathname()` only changes at that commit, so a nav rail
   * driven by it alone stays highlighted on the page you are leaving for the
   * whole round trip, and the click reads as lost.
   *
   * Every nav surface funnels through `navigate`, so recording the intent here
   * moves the WHOLE chrome at once — active item, open section, breadcrumb —
   * because `useResolvedNavigation` derives all of it from one path.
   */
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  /**
   * Whether a navigation is still in flight, from React rather than from the
   * URL.
   *
   * `pendingHref` clears when the pathname changes — the moment the router
   * COMMITS — which is too early for the body: the destination's own
   * `loading.tsx` then takes over for a few hundred milliseconds, so the reader
   * sees one placeholder replaced by a differently shaped one. `isPending`
   * stays true until the new tree is actually ready to show, so the placeholder
   * we render covers the whole wait and hands straight over to content.
   */
  const [navPending, startNavTransition] = React.useTransition();

  const navigate = React.useCallback(
    (href: string) => {
      // Going where we already are would strand the rail's optimistic state:
      // the pathname never changes, so nothing would clear it.
      if (href.split('?')[0] !== pathname) setPendingHref(href);
      startNavTransition(() => {
        router.push(href);
      });
    },
    [router, pathname],
  );
  const prefetch = React.useCallback(
    (href: string) => router.prefetch(href),
    [router],
  );

  const activeSchool = schools.find((s) => s.id === activeSchoolId);
  // The active profile's role — the same label the sidebar switcher shows —
  // surfaced on the mobile top bar (see AppHeader roleLabel).
  const activeRole = profileOptions.find(
    (option) => option.id === activeProfileId,
  )?.caption;
  const tenantName =
    viewer.scope === 'platform'
      ? 'Platform'
      : (activeSchool?.name ?? 'All schools');

  // The route arrived (or the reader went somewhere else entirely) — the URL
  // is the authority again.
  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  // Never leave the rail pointing somewhere the reader never got to.
  React.useEffect(() => {
    if (pendingHref === null) return;
    const timer = setTimeout(() => setPendingHref(null), 10_000);
    return () => clearTimeout(timer);
  }, [pendingHref]);

  const config = configForViewer(viewer);
  const navCounts = useNavCounts(viewer);
  const nav = useResolvedNavigation(config, viewer, pendingHref ?? pathname, {
    onNavigate: navigate,
    onPrefetch: prefetch,
    counts: navCounts,
  });
  // The header bell = the grand total of the rolled-up section badges, i.e.
  // every actionable count across the sections THIS viewer can see (the rail
  // items are already permission-filtered, so restricted users aren't
  // over-counted for destinations they can't reach).
  const notificationCount = React.useMemo(
    () =>
      [...nav.railItems, ...nav.railFooterItems].reduce(
        (sum, item) => sum + (typeof item.badge === 'number' ? item.badge : 0),
        0,
      ),
    [nav.railItems, nav.railFooterItems],
  );
  const sidebarPanels = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(nav.navPanels).map(([key, panel]) => [
          key,
          {
            ...panel,
            header: panel.header
              ? { ...panel.header, subtitle: tenantName }
              : undefined,
          },
        ]),
      ),
    [nav.navPanels, tenantName],
  );

  const sectionTitle =
    nav.navHeader?.title ??
    [...nav.railItems, ...nav.railFooterItems].find((item) => item.active)
      ?.label;
  const activeItem = findActiveNavItem(nav.navGroups.flatMap((g) => g.items));

  // The school switcher already shows the tenant beside the breadcrumb, so the
  // trail starts at the active section (avoids repeating the tenant name).
  const breadcrumbs: BreadcrumbEntry[] = [
    ...(sectionTitle
      ? [{ key: 'section', label: sectionTitle, href: nav.activeHref }]
      : [{ key: 'tenant', label: tenantName }]),
    ...(activeItem && activeItem.label !== sectionTitle
      ? [{ key: 'leaf', label: activeItem.label }]
      : []),
  ];

  return (
    <div className="h-svh w-full">
      <AppShell
        // The pinned rail is a layout sibling that pushes the content column,
        // so it reserves no bottom inset; the floating tab bar does.
        mobileBottomInset={
          mobileRailPinned ? '0rem' : 'calc(4rem + env(safe-area-inset-bottom))'
        }
        mobileNav={
          mobileRailPinned ? null : (
            <MobileNav
              railItems={nav.railItems}
              railFooterItems={nav.railFooterItems}
              navPanels={sidebarPanels}
              schoolSwitcher={renderSchoolSwitcher}
              user={user}
              userMenuItems={userMenu}
              onPin={() => setMobileRailPinned(true)}
            />
          )
        }
        header={
          <AppHeader
            school={viewer.scope === 'school' ? activeSchool : undefined}
            roleLabel={viewer.scope === 'school' ? activeRole : undefined}
            // The pinned rail carries the school chip (and the switch menu);
            // the top bar keeps the role + school name beside it.
            showSchoolMark={!mobileRailPinned}
            breadcrumbs={<AppBreadcrumbs items={breadcrumbs} />}
            search={
              <OmniSearch
                placeholder="Search students, classes, people…"
                onClick={() => setSearchOpen(true)}
              />
            }
            searchAction={<AiWorkspaceLauncher />}
            actions={<HeaderActions notifications={notificationCount} />}
          />
        }
        sidebar={
          <>
            {mobileRailPinned ? (
              <MobileRail
                schoolSwitcher={renderSchoolSwitcher}
                railItems={nav.railItems}
                railFooterItems={nav.railFooterItems}
                navPanels={sidebarPanels}
                user={user}
                userMenuItems={userMenu}
                onUnpin={() => setMobileRailPinned(false)}
              />
            ) : null}
            <AppSidebar
              schoolSwitcher={renderSchoolSwitcher}
              railItems={nav.railItems}
              railFooterItems={nav.railFooterItems}
              navHeader={
                nav.navHeader
                  ? { ...nav.navHeader, subtitle: tenantName }
                  : undefined
              }
              navGroups={nav.navGroups}
              navPanels={sidebarPanels}
              user={user}
              userMenuItems={userMenu}
              defaultExpanded={sidebarExpanded}
              onExpandedChange={writeSidebarPreference}
            />
          </>
        }
      >
        {reminderVisible ? (
          <BiometricEnrollmentBanner
            required={enrollmentRequired}
            requiredBy={biometricEnrollment.requiredBy.map(
              (school) => school.schoolName,
            )}
            setupHref={mustSwitchForEnrollment ? undefined : setupHref}
            onSetup={() => void startEnrollment()}
            setupPending={switchingForEnrollment}
            onSnooze={snoozeEnrollmentReminder}
            onSuppress={suppressEnrollmentReminder}
          />
        ) : null}
        {/* The rail moving on click is only half an answer: until the router
            commits, `children` is still the page being LEFT, so the chrome and
            the content disagree about where the reader is. Show the incoming
            page's placeholder instead — the same one `(app)/loading.tsx`
            renders, so when the boundary takes over nothing changes shape. */}
        {navPending ? <PageChangeSkeleton /> : children}
        <GlobalSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          navigation={config}
          viewer={viewer}
        />
      </AppShell>
      <Dialog
        open={enrollmentPromptOpen}
        onOpenChange={(open) => {
          if (open) setEnrollmentPromptOpen(true);
          else dismissRequiredPrompt();
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <div className="mb-2 grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Fingerprint className="size-5" />
            </div>
            <DialogTitle>Set up biometric sign-in</DialogTitle>
            <DialogDescription>
              {biometricEnrollment.requiredBy.length === 1
                ? `${biometricEnrollment.requiredBy[0]?.schoolName} requires a passkey for faster, phishing-resistant sign-in.`
                : biometricEnrollment.requiredBy.length > 1
                  ? `${biometricEnrollment.requiredBy.length} of your schools require a passkey for faster, phishing-resistant sign-in.`
                  : 'Your school requires a passkey for faster, phishing-resistant sign-in.'}{' '}
              Password and recovery options remain available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={dismissRequiredPrompt}>
              Remind me after this session
            </Button>
            <Button
              onClick={() => void startEnrollment()}
              disabled={switchingForEnrollment}
            >
              {switchingForEnrollment ? 'Switching school…' : 'Set up now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
