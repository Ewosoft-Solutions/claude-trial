import { TablePageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <TablePageSkeleton columns={5} stats={4} actions={1} />;
}
