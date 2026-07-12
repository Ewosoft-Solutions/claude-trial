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
import {
  Bell,
  CircleQuestionMark,
  LogOut,
  Plus,
  Settings,
  User,
} from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { AppShell } from '@workspace/ui/custom/shell/app-shell';
import { AppHeader, OmniSearch } from '@workspace/ui/custom/shell/app-header';
import { AppSidebar } from '@workspace/ui/custom/shell/app-sidebar';
import { SchoolSwitcher } from '@workspace/ui/custom/shell/school-switcher';
import { UserMenu } from '@workspace/ui/custom/shell/user-menu';
import { AppBreadcrumbs } from '@workspace/ui/custom/shell/app-breadcrumbs';
import { ModeToggle } from '@workspace/ui/custom/mode-toggle';
import { useResolvedNavigation } from '@workspace/ui/hooks/use-navigation';
import { findActiveNavItem } from '@workspace/ui/lib/navigation';
import type {
  BreadcrumbEntry,
  UserMenuItem,
} from '@workspace/ui/types/shell.types';

import { useViewer } from '@/app/providers/viewer-provider';
import { configForViewer } from '@/lib/navigation/app-navigation';
import type { UserProfile } from '@workspace/ui/types/shell.types';

const AiWorkspaceLauncher = dynamic(
  () => import('./_shared/ai-workspace').then((mod) => mod.AiWorkspaceLauncher),
  { ssr: false },
);

const USER_MENU: UserMenuItem[] = [
  {
    key: 'profile',
    label: 'Profile',
    icon: <User />,
    href: '/settings/general',
  },
  {
    key: 'settings',
    label: 'Account settings',
    icon: <Settings />,
    href: '/settings/general',
  },
  {
    key: 'signout',
    label: 'Sign out',
    icon: <LogOut />,
    destructive: true,
    separatorBefore: true,
  },
];

/**
 * Compact identity card pinned to the bottom of the secondary nav
 * (AppSidebar's `navFooter` slot). The top bar only tells you which
 * *school* is active — this is the only place a user can tell which
 * *profile* (role) they're currently signed in as, which matters once
 * a user holds more than one (Teacher vs Parent, etc.).
 *
 * No online/away/busy presence indicator: that's a real-time
 * multi-user collaboration signal (Slack/Discord), and this app has no
 * feature yet that consumes it (no live chat, no "who's viewing this
 * record" — deliberately left out rather than adding inert state).
 */
function SidebarProfileFooter({ user }: { user: UserProfile }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[var(--radius-sm)] border border-border bg-card px-2.5 py-2">
      <Avatar className="size-8 shrink-0 rounded-full">
        {user.avatarUrl ? (
          <AvatarImage src={user.avatarUrl} alt={user.name} />
        ) : null}
        <AvatarFallback
          className="text-[11px] font-bold text-white"
          style={{ background: user.color ?? 'var(--muted-foreground)' }}
        >
          {user.initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-semibold text-foreground">
          {user.name}
        </span>
        {user.caption ? (
          <span className="truncate text-xs text-muted-foreground">
            {user.caption}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function HeaderActions() {
  return (
    <>
      <ModeToggle />
      <Button variant="ghost" size="icon-sm" aria-label="Quick add">
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
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Help"
        className="max-md:hidden"
      >
        <CircleQuestionMark />
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
          : item,
      ),
    [router],
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
                  menuLabel="Switch profile"
                />
              ) : undefined
            }
            breadcrumbs={<AppBreadcrumbs items={breadcrumbs} />}
            search={
              <OmniSearch placeholder="Search students, classes, records…" />
            }
            actions={
              <>
                <HeaderActions />
                <div className="mx-0.5 h-5 w-px bg-border max-md:hidden" />
                <UserMenu user={user} items={userMenu} />
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
            navFooter={<SidebarProfileFooter user={user} />}
          />
        }
      >
        {children}
        <AiWorkspaceLauncher />
      </AppShell>
    </div>
  );
}
