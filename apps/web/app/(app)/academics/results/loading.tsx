/* Route loading fallback. Shape matches the page: PageHeader + a cycle card.
   No tab strip on purpose — the workbench tabs live INSIDE the cycle card and
   only appear once a cycle is selected, so promising them here would paint
   chrome that usually is not there.
   (AGENTS.md golden rule 11.) */
import { DetailPageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <DetailPageSkeleton sections={2} withStats={false} actions={1} />;
}
