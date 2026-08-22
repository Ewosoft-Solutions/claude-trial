/* Route loading fallback for the households table. See page-skeletons.tsx. */
import { TablePageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <TablePageSkeleton rows={10} columns={5} actions={2} />;
}
