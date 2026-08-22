/* Route loading fallback — instant skeleton shown while the server
   component streams. Mirrors this page's layout so there is no shift
   when real data arrives. See page-skeletons.tsx. */
import { TablePageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <TablePageSkeleton rows={8} columns={5} stats={4} actions={1} />;
}
