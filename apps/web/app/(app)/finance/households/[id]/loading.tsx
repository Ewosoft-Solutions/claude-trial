/* Route loading fallback for the household detail. See page-skeletons.tsx. */
import { DetailPageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <DetailPageSkeleton sections={3} actions={2} withStats={false} />;
}
