/* Instant paint for a cold load of /login while the server resolves the
   subdomain's tenant (golden rule 11). Auth pages sit outside the app shell,
   so this is a bare centred card rather than a page-skeleton variant. */
import { Skeleton } from '@workspace/ui/components/skeleton';

export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex w-full max-w-sm flex-col gap-4 p-6"
    >
      <span className="sr-only">Loading</span>
      <div aria-hidden className="flex flex-col gap-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
