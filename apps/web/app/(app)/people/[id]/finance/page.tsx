import { serverApiGet } from '@/lib/server-api';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';

import { getPersonDetail } from '../get-detail';
import { PersonProfileShell, ProfileMissing } from '../profile-shell';
import { Section, StatTiles } from '../../person-detail-ui';
import { formatDate, formatMinor, humanize } from '../../person-detail.types';

interface Invoice {
  id: string;
  invoiceNumber?: string | null;
  termName?: string | null;
  amountDue?: number | null;
  amountPaid?: number | null;
  status?: string | null;
  dueDate?: string | null;
}

/* `/finance/invoices` is the same paginated endpoint the finance list uses, so
   it always answers with an envelope — never a bare array. */
interface InvoicesResponse {
  data: Invoice[];
  pagination: { total: number };
}

const STATUS_TONE: Record<
  string,
  'success' | 'warning' | 'destructive' | 'neutral' | 'info'
> = {
  paid: 'success',
  partial: 'info',
  issued: 'neutral',
  draft: 'neutral',
  overdue: 'destructive',
  cancelled: 'neutral',
};

export default async function PersonFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const detail = await getPersonDetail(id, type);
  if (!detail) return <ProfileMissing />;

  const f = detail.finance;
  const invoiceList =
    f && detail.studentId
      ? await serverApiGet<InvoicesResponse>(
          `/finance/invoices?studentId=${encodeURIComponent(detail.studentId)}`,
        )
      : null;
  const invoices = Array.isArray(invoiceList?.data) ? invoiceList.data : [];

  return (
    <PersonProfileShell
      detail={detail}
      activeTab="finance"
      type={type ?? 'all'}
    >
      {!f ? (
        <p className="text-sm text-muted-foreground">
          No finance to show (or you lack permission).
        </p>
      ) : (
        <div className="@container/tiles flex flex-col gap-6">
          <StatTiles
            items={[
              {
                key: 'bal',
                label: 'Balance',
                value: formatMinor(f.balance),
                tone: f.balance > 0 ? 'destructive' : undefined,
              },
              { key: 'due', label: 'Billed', value: formatMinor(f.totalDue) },
              { key: 'paid', label: 'Paid', value: formatMinor(f.totalPaid) },
              {
                key: 'overdue',
                label: 'Overdue',
                value: f.overdueCount,
                tone: f.overdueCount > 0 ? 'destructive' : undefined,
              },
              {
                key: 'next',
                label: 'Next due',
                value: formatDate(f.nextDueDate) ?? '—',
              },
            ]}
          />

          <Section title="Invoices">
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {invoices.map((inv) => {
                  const balance = (inv.amountDue ?? 0) - (inv.amountPaid ?? 0);
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          {inv.invoiceNumber ?? 'Invoice'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {inv.termName ? <span>{inv.termName}</span> : null}
                          {inv.dueDate ? (
                            <span>· due {formatDate(inv.dueDate)}</span>
                          ) : null}
                          {inv.status ? (
                            <StatusBadge
                              tone={STATUS_TONE[inv.status] ?? 'neutral'}
                              dot
                            >
                              {humanize(inv.status)}
                            </StatusBadge>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-foreground">
                        {formatMinor(balance)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      )}
    </PersonProfileShell>
  );
}
