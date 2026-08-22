/* Route loading fallback — instant skeleton shown while the roster streams.
   A single-column picker, so the form skeleton matches. See page-skeletons.tsx. */
import { FormPageSkeleton } from '@workspace/ui/custom/states/page-skeletons';

export default function Loading() {
  return <FormPageSkeleton fields={6} actions={1} />;
}
