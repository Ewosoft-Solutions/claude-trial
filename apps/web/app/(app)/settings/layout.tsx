'use client';

import { usePathname } from 'next/navigation';

import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

import { SCHOOL_NAV } from '@/lib/navigation/app-navigation';

/** The section's own name is the page title — the active school is already
 *  shown in the top bar + school switcher, so a generic "School settings /
 *  <school>" heading is redundant (finance/students pages title themselves the
 *  same way). Derived from the single nav source of truth, so it never drifts
 *  as settings pages are added. */
function settingsSectionTitle(pathname: string): string {
  const section = SCHOOL_NAV.sections.find((s) => s.key === 'settings');
  const items = (section?.groups ?? []).flatMap((group) =>
    group.items.flatMap((item) => [item, ...(item.items ?? [])]),
  );
  const match = items
    .filter(
      (item) =>
        item.href &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`)),
    )
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];
  return match?.label ?? 'School settings';
}

/** School Settings behaves like every other primary navigation section: its
 * section list lives in the shell's secondary panel (and curved mobile
 * flyout), so the page content does not repeat that navigation. */
export default function SettingsSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader title={settingsSectionTitle(pathname)} />
        {children}
      </div>
    </ShellMain>
  );
}
