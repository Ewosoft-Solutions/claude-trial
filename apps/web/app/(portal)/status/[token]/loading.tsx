/* Instant paint for a public portal page while its server fetch resolves
   (golden rule 11). Portal pages render outside the app shell. */
import { Skeleton } from '@workspace/ui/components/skeleton';

export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-6"
    >
      <span className="sr-only">Loading</span>
      <div aria-hidden className="flex flex-col gap-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
        <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
      </div>
    </div>
  );
}
