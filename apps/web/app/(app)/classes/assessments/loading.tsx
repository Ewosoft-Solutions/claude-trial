/* Route loading fallback. The page renders a `list-detail-layout` behind a
   subject picker and a search, so the panes were right but the control row
   above them was missing — the placeholder stood a whole row short.
   (AGENTS.md golden rule 11.) */
import { ListDetailPageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <ListDetailPageSkeleton actions={1} filters={2} listRows={6} />;
}
