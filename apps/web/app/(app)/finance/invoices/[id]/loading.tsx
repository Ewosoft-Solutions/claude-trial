/* Route loading fallback for the invoice detail — header + financial tiles +
   line/adjustment sections. See page-skeletons.tsx. */
import { DetailPageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <DetailPageSkeleton sections={3} withStats actions={1} />;
}
