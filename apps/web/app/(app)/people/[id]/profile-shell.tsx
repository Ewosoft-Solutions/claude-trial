import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Button } from '@workspace/ui/components/button';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

import { AvatarLightbox } from '../avatar-lightbox';
import { FlagChips, ProfileChips } from '../person-detail-ui';
import {
  availableTabs,
  profileSubtitle,
  tabLabel,
  type DetailTab,
  type PersonDetail,
} from '../person-detail.types';

/**
 * The profile chrome: back-link, header (expandable avatar + name + chips +
 * at-a-glance flags) and the deep-linkable tab nav. Rendered by every
 * /people/[id]/* tab page (layouts can't read `searchParams`, so the shell
 * lives in the pages).
 */
export function PersonProfileShell({
  detail,
  activeTab,
  type,
  children,
}: {
  detail: PersonDetail;
  activeTab: DetailTab;
  type: string;
  children: React.ReactNode;
}) {
  const tabs = availableTabs(detail);
  const q = `?type=${encodeURIComponent(type)}`;
  const href = (t: DetailTab) =>
    t === 'overview'
      ? `/people/${detail.id}${q}`
      : `/people/${detail.id}/${t}${q}`;

  return (
    <ShellMain>
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/people">
          <ArrowLeft aria-hidden /> Back to People
        </Link>
      </Button>

      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-start gap-4">
          <AvatarLightbox name={detail.name} />
          <div className="flex min-w-0 flex-col gap-2">
            <div className="min-w-0">
              <h1 className="font-display text-[26px] font-bold leading-tight text-foreground">
                {detail.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {profileSubtitle(detail)}
              </p>
            </div>
            <ProfileChips profiles={detail.profiles} />
            <FlagChips flags={detail.flags} />
          </div>
        </header>

        {tabs.length > 1 ? (
          <nav className="flex gap-1 overflow-x-auto border-b border-border">
            {tabs.map((t) => (
              <Link
                key={t}
                href={href(t)}
                aria-current={t === activeTab ? 'page' : undefined}
                className={cn(
                  'shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  t === activeTab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {tabLabel(t)}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="@container/main">{children}</div>
      </div>
    </ShellMain>
  );
}

/** Shared not-found / denied fallback for the tab pages. */
export function ProfileMissing() {
  return (
    <ShellMain>
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/people">
          <ArrowLeft aria-hidden /> Back to People
        </Link>
      </Button>
      <div className="rounded-[var(--radius)] border border-border bg-card p-8 text-center">
        <h1 className="font-display text-xl font-bold text-foreground">
          Person not available
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This person does not exist, or your role does not allow viewing them.
        </p>
      </div>
    </ShellMain>
  );
}
