/* ============================================================
   /transport/pickups — pickup schedule (server component)

   Every assignment that carries a pickup time or a stop, ordered by
   time. Data comes from the NestJS GET /transport/pickups view; search /
   filters / sort / paging run client-side in PickupsClient.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';

import { PickupsClient, type Pickup } from './pickups-client';

export default async function TransportPickupsPage() {
  const pickups = (await serverApiGet<Pickup[]>('/transport/pickups')) ?? [];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Pickups & drops"
          description="The pickup schedule — every rider with a stop or pickup time, ordered by time."
        />
        <PickupsClient pickups={pickups} />
      </div>
    </ShellMain>
  );
}
