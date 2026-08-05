/* Route loading fallback — instant skeleton while the server component streams.
   See page-skeletons.tsx. */
import { TablePageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <TablePageSkeleton columns={3} rows={6} />;
}
