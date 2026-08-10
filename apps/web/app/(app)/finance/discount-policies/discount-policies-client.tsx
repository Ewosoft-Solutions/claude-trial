'use client';

/* ============================================================
   DiscountPoliciesClient — reusable auto-applied discount rules

   Create a policy (fixed ₦ off or a % of a target fee item / the whole invoice)
   and a *different* authority activates it (maker-checker). Active policies
   auto-apply to invoices when they're issued. Amounts are kobo; percentages are
   basis points (1000 = 10%). Write controls render only when `canManage`.
   ============================================================ */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Plus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@workspace/ui/components/toggle-group';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { authedFetch } from '@/lib/authed-fetch';
import { formatNaira as naira } from '@/lib/format';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export interface CatalogueItem {
  id: string;
  code: string;
  name: string;
}

export interface ApiPolicy {
  id: string;
  name: string;
  type: 'discount' | 'scholarship';
  feeItemId?: string | null;
  amount?: number | null;
  percentBps?: number | null;
  reason?: string | null;
  status: 'pending' | 'active' | 'inactive';
  feeItem?: { code: string; name: string } | null;
}

const POLICY_TYPES = ['discount', 'scholarship'] as const;

const STATUS_META: Record<string, { label: string; tone: StateTone }> = {
  pending: { label: 'Pending activation', tone: 'warning' },
  active: { label: 'Active', tone: 'success' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

function koboFromNaira(input: string): number | null {
  const t = input.trim();
  if (t === '') return null;
  const n = Number(t.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function policyValue(p: ApiPolicy): string {
  if (p.amount != null) return `${naira(p.amount)} off`;
  if (p.percentBps != null) return `${p.percentBps / 100}% off`;
  return '—';
}

export function DiscountPoliciesClient({
  policies,
  catalogue,
  canManage,
}: {
  policies: ApiPolicy[];
  catalogue: CatalogueItem[];
  canManage: boolean;
}) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const columns: DirectoryColumn<ApiPolicy>[] = [
    {
      id: 'name',
      header: 'Policy',
      sortable: true,
      cell: (p) => (
        <div className="flex min-w-0 flex-col">
          <span className="font-medium text-foreground">{p.name}</span>
          <span className="text-xs text-muted-foreground">
            {titleCase(p.type)}
            {p.reason ? ` · ${p.reason}` : ''}
          </span>
        </div>
      ),
    },
    {
      id: 'appliesTo',
      header: 'Applies to',
      hideable: true,
      cell: (p) => (
        <span className="text-muted-foreground">
          {p.feeItem?.name ?? 'Whole invoice'}
        </span>
      ),
    },
    {
      id: 'value',
      header: 'Value',
      align: 'end',
      cell: (p) => <span className="tabular-nums">{policyValue(p)}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (p) => {
        const meta = STATUS_META[p.status] ?? {
          label: titleCase(p.status),
          tone: 'neutral' as StateTone,
        };
        return (
          <StatusBadge tone={meta.tone} dot={p.status !== 'inactive'}>
            {meta.label}
          </StatusBadge>
        );
      },
    },
    ...(canManage
      ? ([
          {
            id: 'actions',
            header: 'Actions',
            align: 'end',
            cell: (p: ApiPolicy) =>
              p.status === 'pending' ? (
                <ActivatePolicyButton policyId={p.id} />
              ) : null,
          },
        ] as DirectoryColumn<ApiPolicy>[])
      : []),
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const type = filters.type;
    let out = policies.filter((p) => {
      const matchesQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.reason?.toLowerCase().includes(q) ?? false);
      const matchesStatus = !status || p.status === status;
      const matchesType = !type || p.type === type;
      return matchesQ && matchesStatus && matchesType;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      out = [...out].sort((a, b) =>
        sort.field === 'status'
          ? dir * a.status.localeCompare(b.status)
          : dir * a.name.localeCompare(b.name),
      );
    }
    return out;
  }, [policies, term, filters, sort]);

  const activeCount = policies.filter((p) => p.status === 'active').length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasQuery = term.trim() !== '' || Object.values(filters).some(Boolean);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Discount policies"
          actions={
            canManage ? <CreatePolicyDialog catalogue={catalogue} /> : undefined
          }
        />

        <DirectoryTable<ApiPolicy>
          title="Policies"
          description={`${filtered.length} ${filtered.length === 1 ? 'policy' : 'policies'} · ${activeCount} active`}
          columns={columns}
          rows={pageRows}
          getRowId={(p) => p.id}
          getRowLabel={(p) => p.name}
          total={filtered.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={sort}
          onSortChange={(field) =>
            setSort((cur) =>
              cur?.field !== field
                ? { field, dir: 'asc' }
                : cur.dir === 'asc'
                  ? { field, dir: 'desc' }
                  : null,
            )
          }
          caption="Discount policies"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search policy or reason…',
            label: 'Search policies',
            id: 'policies-search',
          }}
          filters={[
            {
              key: 'status',
              label: 'Status',
              options: [
                { value: 'pending', label: 'Pending activation' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ],
            },
            {
              key: 'type',
              label: 'Type',
              options: [
                { value: 'discount', label: 'Discount' },
                { value: 'scholarship', label: 'Scholarship' },
              ],
            },
          ]}
          filterValues={filters}
          onFilterChange={(key, value) =>
            setFilters((f) => ({ ...f, [key]: value }))
          }
          onClearFilters={() => setFilters({})}
          emptyState={
            <EmptyState
              compact
              title={
                hasQuery
                  ? 'No policies match your filters'
                  : 'No discount policies'
              }
              description={
                hasQuery
                  ? 'Try a different search term, or clear the filters.'
                  : canManage
                    ? 'Create a policy (e.g. a sibling discount). A second authority activates it, then it auto-applies to invoices at issue.'
                    : 'No discount policies configured.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}

function CreatePolicyDialog({ catalogue }: { catalogue: CatalogueItem[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [type, setType] =
    React.useState<(typeof POLICY_TYPES)[number]>('discount');
  const [mode, setMode] = React.useState<'amount' | 'percent'>('percent');
  const [amount, setAmount] = React.useState('');
  const [percent, setPercent] = React.useState('');
  const [feeItemId, setFeeItemId] = React.useState('all');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName('');
      setType('discount');
      setMode('percent');
      setAmount('');
      setPercent('');
      setFeeItemId('all');
      setReason('');
    }
  }, [open]);

  const amountKobo = koboFromNaira(amount);
  const percentNum = Number(percent.trim());
  const percentBps =
    percent.trim() !== '' && Number.isFinite(percentNum) && percentNum > 0
      ? Math.round(percentNum * 100)
      : null;
  const valueOk =
    mode === 'amount'
      ? amountKobo != null && amountKobo > 0
      : percentBps != null && percentBps > 0 && percentBps <= 10000;
  const canSubmit = name.trim() !== '' && valueOk && !busy;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus aria-hidden /> New policy
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a discount policy</DialogTitle>
          <DialogDescription>
            It stays pending until a different authority activates it, then
            auto-applies to invoices at issue.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-name">Name</Label>
            <Input
              id="pol-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sibling discount"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pol-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) =>
                  setType(v as (typeof POLICY_TYPES)[number])
                }
              >
                <SelectTrigger id="pol-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLICY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {titleCase(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pol-target">Applies to</Label>
              <Select value={feeItemId} onValueChange={setFeeItemId}>
                <SelectTrigger id="pol-target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Whole invoice</SelectItem>
                  {catalogue.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Discount</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={mode}
              onValueChange={(v) => {
                if (v) setMode(v as 'amount' | 'percent');
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="percent" className="px-4">
                Percentage
              </ToggleGroupItem>
              <ToggleGroupItem value="amount" className="px-4">
                Fixed amount
              </ToggleGroupItem>
            </ToggleGroup>
            {mode === 'percent' ? (
              <Input
                inputMode="decimal"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="10 (%)"
                autoComplete="off"
                aria-label="Percentage off"
              />
            ) : (
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000 (₦)"
                autoComplete="off"
                aria-label="Amount off in naira"
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pol-reason">
              Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="pol-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Second and subsequent siblings"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={!canSubmit}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await authedFetch(
                  '/api/finance/discount-policies',
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      name: name.trim(),
                      type,
                      feeItemId: feeItemId === 'all' ? undefined : feeItemId,
                      amount: mode === 'amount' ? amountKobo : undefined,
                      percentBps: mode === 'percent' ? percentBps : undefined,
                      reason: reason.trim() || undefined,
                    }),
                  },
                );
                if (!res.ok) {
                  const d = (await res.json().catch(() => null)) as {
                    message?: string;
                  } | null;
                  throw new Error(
                    d?.message ?? `Request failed (${res.status})`,
                  );
                }
                toast.success('Policy created — awaiting activation');
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Create failed');
              } finally {
                setBusy(false);
              }
            }}
          >
            Create policy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivatePolicyButton({ policyId }: { policyId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="default" size="sm" onClick={() => setOpen(true)}>
        <Check aria-hidden /> Activate
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Activate this policy?</DialogTitle>
          <DialogDescription>
            It will auto-apply to invoices at issue. You must be a different
            person than whoever created it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-2">
          <Label htmlFor="activate-reason">
            Reason <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="activate-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Approved at finance committee"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = await authedFetch(
                  `/api/finance/discount-policies/${policyId}/activate`,
                  {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                      reason: reason.trim() || undefined,
                    }),
                  },
                );
                if (!res.ok) {
                  const d = (await res.json().catch(() => null)) as {
                    message?: string;
                  } | null;
                  throw new Error(
                    d?.message ?? `Request failed (${res.status})`,
                  );
                }
                toast.success('Policy activated');
                setOpen(false);
                router.refresh();
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : 'Activation failed',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Activate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
