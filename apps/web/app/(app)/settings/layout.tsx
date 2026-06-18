'use client';

/* ============================================================
   (app)/settings/layout — settings shell

   Renders the M6 SettingsLayout once (PageHeader + section nav)
   and slots each section page in as the content panel. The active
   section derives from the route (usePathname); nav items are plain
   links so navigation is real client-side routing. Section pages
   under this group render only their own panel content.

   Note: every section is listed here unconditionally. This layout now
   owns the settings section nav — the shell's main nav model no longer
   carries the settings sub-items (they would only duplicate this panel),
   so per-permission filtering of individual sections is a follow-up to add
   here (reading the viewer's permissions). The mock Owner sees them all.
   ============================================================ */

import { usePathname } from 'next/navigation';
import {
  Palette,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  ToggleRight,
  Users,
} from 'lucide-react';

import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { SettingsLayout } from '@workspace/ui/custom/layouts/settings-layout';
import type { SettingsNavItem } from '@workspace/ui/types/layout.types';

const SECTIONS: Omit<SettingsNavItem, 'active'>[] = [
  { key: 'general', label: 'General', description: 'Profile & locale', icon: <SettingsIcon />, href: '/settings/general' },
  { key: 'branding', label: 'Branding', description: 'Logo, colours, theme', icon: <Palette />, href: '/settings/branding' },
  { key: 'features', label: 'Features', description: 'Module toggles', icon: <ToggleRight />, href: '/settings/features' },
  { key: 'roles', label: 'Roles & permissions', description: 'Access control', icon: <ShieldCheck />, href: '/settings/roles' },
  { key: 'users', label: 'Users', description: 'Staff accounts', icon: <Users />, href: '/settings/users' },
  { key: 'audit', label: 'Audit log', description: 'Activity history', icon: <ScrollText />, href: '/settings/audit' },
];

export default function SettingsSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const nav: SettingsNavItem[] = SECTIONS.map((s) => ({
    ...s,
    active: pathname === s.href || pathname.startsWith(`${s.href}/`),
  }));

  return (
    <ShellMain>
      <SettingsLayout
        header={
          <PageHeader
            title="Settings"
            meta={[{ key: 'tenant', label: 'St. Jude Academy', emphasis: true }]}
          />
        }
        nav={nav}
      >
        {children}
      </SettingsLayout>
    </ShellMain>
  );
}
