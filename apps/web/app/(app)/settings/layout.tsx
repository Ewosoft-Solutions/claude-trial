'use client';

import { usePathname } from 'next/navigation';

import { PageChangeSkeleton } from '@workspace/ui/custom/states/page-skeletons';

import { staysWithinChrome, useNavPending } from '@/lib/navigation/nav-pending';
import {
  hasRouteSkeleton,
  RouteSkeleton,
} from '@/lib/navigation/route-skeletons';

import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

import { SCHOOL_NAV } from '@/lib/navigation/app-navigation';

/** A one-line description under each section title. Kept here (page content,
 *  keyed by route) rather than in the nav config, which is navigation-only. */
const SETTINGS_DESCRIPTIONS: Record<string, string> = {
  '/settings/general':
    "Your school's name, contact details, academic year, and locale.",
  '/settings/branding': 'Logo, colours, and theme for your school workspace.',
  '/settings/features': 'Turn optional modules on or off for your school.',
  '/settings/security':
    'Sign-in, session, and sensitive-operation policies for this school.',
  '/settings/ai-usage':
    'AI features, usage this month, and analytics settings.',
  '/settings/roles':
    'Build scoped roles from templates and preview their effective access.',
  '/settings/users': 'Invite people and manage who has access to this school.',
  '/settings/audit':
    'A record of significant actions taken across this school.',
};

/** The section's own name is the page title — the active school is already
 *  shown in the top bar + school switcher, so a generic "School settings /
 *  <school>" heading is redundant (finance/students pages title themselves the
 *  same way). Title is derived from the single nav source of truth, so it never
 *  drifts as settings pages are added; the description is looked up by route. */
function settingsSection(pathname: string): {
  title: string;
  description?: string;
} {
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
  return {
    title: match?.label ?? 'School settings',
    description: match?.href ? SETTINGS_DESCRIPTIONS[match.href] : undefined,
  };
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
  const { navPending, pendingHref } = useNavPending();

  // Moving between settings sections keeps this frame, so the shell leaves it
  // alone (see nav-pending) and only the body below is replaced. Two things
  // follow from that, and both matter:
  //
  //   · the heading must name the section being OPENED, not the one being
  //     left — otherwise the frame contradicts the body beneath it, the same
  //     way the profile's tab strip used to; and
  //   · the body shows a placeholder until the route commits.
  const withinSettings = navPending && staysWithinChrome(pathname, pendingHref);
  const { title, description } = settingsSection(
    withinSettings && pendingHref ? pendingHref : pathname,
  );

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader title={title} description={description} />
        {withinSettings ? (
          hasRouteSkeleton(pendingHref) ? (
            <RouteSkeleton href={pendingHref} />
          ) : (
            <PageChangeSkeleton />
          )
        ) : (
          children
        )}
      </div>
    </ShellMain>
  );
}
