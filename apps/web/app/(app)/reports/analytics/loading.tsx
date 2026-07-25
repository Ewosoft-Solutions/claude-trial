/* Route loading fallback — instant skeleton shown while the server
   component streams. Mirrors this page's layout so there is no shift
   when real data arrives. See page-skeletons.tsx. */
import { ReportPageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <ReportPageSkeleton stats={4} charts={2} />;
}
