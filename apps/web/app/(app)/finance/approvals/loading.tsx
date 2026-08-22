/* Route loading fallback — instant skeleton while the queue streams.
   See page-skeletons.tsx. */
import { TablePageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <TablePageSkeleton rows={10} columns={8} stats={0} />;
}
