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
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  CircleQuestionMark,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  User,
} from 'lucide-react';

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

const USER_MENU: UserMenuItem[] = [
  { key: 'profile', label: 'Profile', icon: <User />, href: '/settings/general' },
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

function HeaderActions() {
  return (
    <>
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
  const { viewer, user, schools, activeSchoolId, setActiveSchool } =
    useViewer();
  const router = useRouter();
  const pathname = usePathname();

  const navigate = React.useCallback(
    (href: string) => router.push(href),
    [router],
  );

  const config = configForViewer(viewer);
  const nav = useResolvedNavigation(config, viewer, pathname, {
    onNavigate: navigate,
  });

  const activeSchool = schools.find((s) => s.id === activeSchoolId);
  const tenantName =
    viewer.scope === 'platform'
      ? 'Platform'
      : (activeSchool?.name ?? 'All schools');

  const sectionTitle = nav.navHeader?.title;
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
                  schools={schools}
                  activeSchoolId={activeSchoolId}
                  onSchoolChange={(s) => setActiveSchool(s.id)}
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
                <UserMenu user={user} items={USER_MENU} />
              </>
            }
          />
        }
        sidebar={
          <AppSidebar
            brand={
              <span className="grid size-[30px] place-items-center rounded-[9px] bg-primary text-primary-foreground shadow-accent">
                <Sparkles className="size-4" />
              </span>
            }
            railItems={nav.railItems}
            railFooterItems={nav.railFooterItems}
            navHeader={
              nav.navHeader
                ? { ...nav.navHeader, subtitle: tenantName }
                : undefined
            }
            navGroups={nav.navGroups}
          />
        }
      >
        {children}
      </AppShell>
    </div>
  );
}
