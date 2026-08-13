/* Route loading fallback — mirrors the application-detail layout (avatar header
   + decision card + the three two-column card rows) so it doesn't jump on load. */
import { Skeleton } from '@workspace/ui/components/skeleton';
import { Card, CardContent, CardHeader } from '@workspace/ui/components/card';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

function CardBlock({ lines = 4 }: { lines?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export default function Loading() {
  return (
    <ShellMain>
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-28" />

        <div className="flex flex-wrap items-start gap-3">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="flex min-w-[min(100%,14rem)] flex-1 flex-col gap-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        <CardBlock lines={3} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <CardBlock lines={4} />
            <CardBlock lines={3} />
          </div>
          <CardBlock lines={5} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CardBlock lines={3} />
          <CardBlock lines={3} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CardBlock lines={3} />
          <CardBlock lines={3} />
        </div>
      </div>
    </ShellMain>
  );
}
