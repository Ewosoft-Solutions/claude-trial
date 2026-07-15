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
import { Bell, LogOut, Plus, SlidersHorizontal } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { AppShell } from '@workspace/ui/custom/shell/app-shell';
import { AppHeader, OmniSearch } from '@workspace/ui/custom/shell/app-header';
import { AppSidebar } from '@workspace/ui/custom/shell/app-sidebar';
import { SchoolSwitcher } from '@workspace/ui/custom/shell/school-switcher';
import { UserMenu } from '@workspace/ui/custom/shell/user-menu';
import { AppBreadcrumbs } from '@workspace/ui/custom/shell/app-breadcrumbs';
import { useResolvedNavigation } from '@workspace/ui/hooks/use-navigation';
import { findActiveNavItem } from '@workspace/ui/lib/navigation';
import type {
  BreadcrumbEntry,
  UserMenuItem,
} from '@workspace/ui/types/shell.types';

import { useViewer } from '@/app/providers/viewer-provider';
import { configForViewer } from '@/lib/navigation/app-navigation';

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

function HeaderActions() {
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
        aria-label="Notifications"
        className="relative"
      >
        <Bell />
        <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-info text-[10px] font-bold text-info-foreground">
          3
        </span>
      </Button>
    </>
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const {
    viewer,
    user,
    schools,
    activeSchoolId,
    activeProfileId,
    switchProfile,
  } = useViewer();
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

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

  const userMenu: UserMenuItem[] = React.useMemo(
    () =>
      USER_MENU.map((item) =>
        item.key === 'signout'
          ? {
              ...item,
              onSelect: async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.push('/login');
                router.refresh();
              },
            }
          : item.key === 'account'
            ? {
                ...item,
                href: `/account/profile?from=${encodeURIComponent(pathname)}`,
              }
            : item,
      ),
    [pathname, router],
  );

  const navigate = React.useCallback(
    (href: string) => router.push(href),
    [router],
  );
  const prefetch = React.useCallback(
    (href: string) => router.prefetch(href),
    [router],
  );

  const activeSchool = schools.find((s) => s.id === activeSchoolId);
  const tenantName =
    viewer.scope === 'platform'
      ? 'Platform'
      : (activeSchool?.name ?? 'All schools');

  const config = configForViewer(viewer);
  const nav = useResolvedNavigation(config, viewer, pathname, {
    onNavigate: navigate,
    onPrefetch: prefetch,
  });
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
        header={
          <AppHeader
            schoolSwitcher={
              viewer.scope === 'school' ? (
                <SchoolSwitcher
                  schools={profileOptions}
                  activeSchoolId={activeProfileId}
                  onSchoolChange={handleProfileChange}
                  menuLabel="Schools and roles"
                />
              ) : undefined
            }
            breadcrumbs={<AppBreadcrumbs items={breadcrumbs} />}
            search={
              <OmniSearch
                placeholder="Search students, classes, people…"
                onClick={() => setSearchOpen(true)}
              />
            }
            actions={
              <>
                <HeaderActions />
                <div className="mx-0.5 h-5 w-px bg-border max-sm:hidden" />
                <UserMenu user={user} items={userMenu} showTriggerLabel />
              </>
            }
          />
        }
        sidebar={
          <AppSidebar
            railItems={nav.railItems}
            railFooterItems={nav.railFooterItems}
            navHeader={
              nav.navHeader
                ? { ...nav.navHeader, subtitle: tenantName }
                : undefined
            }
            navGroups={nav.navGroups}
            navPanels={sidebarPanels}
          />
        }
      >
        {children}
        <AiWorkspaceLauncher />
        <GlobalSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          navigation={config}
          viewer={viewer}
        />
      </AppShell>
    </div>
  );
}
