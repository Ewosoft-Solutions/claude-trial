import { TablePageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <TablePageSkeleton rows={10} columns={9} stats={4} actions={2} />;
}
