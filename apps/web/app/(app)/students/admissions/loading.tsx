/* Route loading fallback — instant skeleton while the server component streams. */
import { TablePageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <TablePageSkeleton rows={6} columns={5} actions={2} />;
}
