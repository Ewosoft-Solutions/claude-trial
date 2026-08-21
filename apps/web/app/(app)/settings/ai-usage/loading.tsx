/* Route loading fallback. Shape matches the page: cards-dominant, not a report.
   (AGENTS.md golden rule 11 — the skeleton must be the content's silhouette,
   so nothing reflows when data lands.) */
import { DetailPageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <DetailPageSkeleton sections={3} withStats />;
}
