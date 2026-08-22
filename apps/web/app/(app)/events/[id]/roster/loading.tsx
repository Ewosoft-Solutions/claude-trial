/* Route loading fallback. Shape matches the page: PageHeader + DirectoryTable.
   (AGENTS.md golden rule 11 — the skeleton must be the content's silhouette,
   so nothing reflows when data lands.) */
import { TablePageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <TablePageSkeleton rows={10} columns={4} />;
}
