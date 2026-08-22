import { TablePageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <TablePageSkeleton columns={9} stats={4} actions={2} />;
}
