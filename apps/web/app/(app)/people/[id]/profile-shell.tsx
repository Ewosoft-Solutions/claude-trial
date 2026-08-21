import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import { Button } from '@workspace/ui/components/button';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

import { AvatarLightbox } from '../avatar-lightbox';
import { FlagChips, ProfileChips } from '../person-detail-ui';
import { availableTabs, profileSubtitle } from '../person-detail.types';
import type { PersonDetail } from '../person-detail.types';
import { ProfileBody, ProfileNavProvider, ProfileTabs } from './profile-nav';

/**
 * The profile chrome: back-link, header (expandable avatar + name + chips +
 * at-a-glance flags) and the deep-linkable tab nav.
 *
 * Rendered by the [id] LAYOUT, not by the tab pages. That is the whole point:
 * a layout is preserved across navigation between its children, so moving
 * from tab to tab re-renders only the body below. Rendered per page — as this
 * was — every tab click tore the header down and rebuilt it, which read as a
 * full page reload.
 */
export function PersonProfileShell({
  detail,
  children,
}: {
  detail: PersonDetail;
  children: React.ReactNode;
}) {
  return (
    <ProfileNavProvider personId={detail.id} tabs={availableTabs(detail)}>
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
                <PageTitle className="capitalize">{detail.name}</PageTitle>
                <p className="text-sm text-muted-foreground">
                  {profileSubtitle(detail)}
                </p>
              </div>
              <ProfileChips profiles={detail.profiles} />
              <FlagChips flags={detail.flags} />
            </div>
          </header>

          {/* Routes, not local state: each tab is its own page, so these stay
            real links — deep-linkable, right-clickable, and the browser's
            back button walks them. The strip and the body share one pending
            state so they can never disagree about which tab is showing. */}
          <ProfileTabs />

          <div className="@container/main">
            <ProfileBody>{children}</ProfileBody>
          </div>
        </div>
      </ShellMain>
    </ProfileNavProvider>
  );
}

/** Shared not-found / denied fallback for the profile. */
export function ProfileMissing() {
  return (
    <ShellMain>
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/people">
          <ArrowLeft aria-hidden /> Back to People
        </Link>
      </Button>
      <div className="rounded-[var(--radius)] border border-border bg-card p-8 text-center">
        <PageTitle className="mx-auto">Person not available</PageTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          This person does not exist, or your role does not allow viewing them.
        </p>
      </div>
    </ShellMain>
  );
}
