'use client';

import { DetailBodySkeleton } from '@workspace/ui/custom/states/page-skeletons';

import { DETAIL_TABS, type DetailTab } from '../person-detail.types';

/**
 * The placeholder for a profile tab's body — ONE definition, because two
 * different things render it at two different moments of the same wait:
 *
 *   · `ProfileBody`, from the click until the router commits, for the tab the
 *     reader ASKED for; and
 *   · this segment's `loading.tsx`, from the commit until the body resolves,
 *     for the tab the URL now names.
 *
 * They are the same tab, so they must draw the same thing. When they did not,
 * the handover between them was visible as a second, differently shaped loader
 * appearing mid-wait — the skeleton grew by a block and the stat row came and
 * went, which read as a glitch rather than as loading.
 *
 * Each shape mirrors what that tab actually renders, so the placeholder is
 * replaced rather than rearranged.
 */
export function ProfileTabSkeleton({ tab }: { tab: DetailTab }) {
  switch (tab) {
    // Stat tiles above a single list — classes, or invoices.
    case 'academics':
    case 'finance':
      return <DetailBodySkeleton sections={1} withStats />;
    // A list of people, or of documents. No stat row.
    case 'people':
    case 'documents':
      return <DetailBodySkeleton sections={2} />;
    // Overview is the long one: contact, identity, enrolment, then whichever
    // of the account / access / employment panels the viewer may see.
    case 'overview':
    default:
      return <DetailBodySkeleton sections={4} />;
  }
}

/** The tab a profile pathname names, for callers that only have the URL. */
export function profileTabFromPathname(pathname: string): DetailTab {
  const segment = pathname.split('/').filter(Boolean).slice(2)[0];
  return segment && (DETAIL_TABS as readonly string[]).includes(segment)
    ? (segment as DetailTab)
    : 'overview';
}
