/* Route loading fallback — instant skeleton while the server component
   streams the active People tab. Mirrors the workbench table layout. */
import { TablePageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <TablePageSkeleton rows={10} columns={4} stats={6} actions={1} />;
}
