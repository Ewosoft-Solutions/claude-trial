/* ============================================================
   /transport/routes — routes view (server component)

   Folds transport assignments into one row per route (riders,
   vehicles, stops, pickup window, per-status breakdown). Data comes
   from the NestJS GET /transport/routes aggregation; search / filters /
   sort / paging run client-side in RoutesClient.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';

import { RoutesClient, type Route } from './routes-client';

export default async function TransportRoutesPage() {
  const routes = (await serverApiGet<Route[]>('/transport/routes')) ?? [];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Routes"
          description="Each bus route with its riders, vehicles, stops, and pickup window."
        />
        <RoutesClient routes={routes} />
      </div>
    </ShellMain>
  );
}
