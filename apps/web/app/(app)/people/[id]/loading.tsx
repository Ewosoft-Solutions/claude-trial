/* Route loading fallback — instant skeleton while the profile detail streams. */
import { DetailPageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <DetailPageSkeleton sections={3} withStats={false} actions={1} />;
}
