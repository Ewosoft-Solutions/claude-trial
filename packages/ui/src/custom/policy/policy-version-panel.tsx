'use client';

/* ============================================================
   PolicyVersionPanel — versioned config: clone / compare / activate (F8)

   The shared surface for anything that is versioned rather than
   mutated: a curriculum version, a role/access policy, a fee
   schedule, a security policy. A left rail lists versions (with
   the active one badged + effective dates); the right pane shows
   the selected version's actions — Clone (fork a draft), Compare
   (a before/after diff), Activate (make current) — or, when
   `compareRows` is supplied, the diff itself. Presentational +
   controlled: the host owns selection and performs the actions.
   ============================================================ */

import * as React from 'react';
import { Copy, GitCompare, Power } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Button } from '@workspace/ui/components/button';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type {
  PolicyCompareRow,
  PolicyVersion,
} from '@workspace/ui/types/patterns.types';

export interface PolicyVersionPanelProps {
  versions: PolicyVersion[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onClone?: (id: string) => void;
  onCompare?: (id: string) => void;
  onActivate?: (id: string) => void;
  /** When set, the right pane shows this before/after diff instead of actions. */
  compareRows?: PolicyCompareRow[];
  compareTitle?: string;
  className?: string;
}

export function PolicyVersionPanel({
  versions,
  selectedId,
  onSelect,
  onClone,
  onCompare,
  onActivate,
  compareRows,
  compareTitle,
  className,
}: PolicyVersionPanelProps) {
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0];

  return (
    <div
      data-slot="policy-panel"
      className={cn(
        '@container/policy grid gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-3 @2xl/policy:grid-cols-[minmax(13rem,18rem)_1fr]',
        className,
      )}
    >
      {/* Version rail — a labelled group of toggle buttons (not a listbox: each
          option is a normal Tab stop, so `aria-pressed` conveys selection while
          the keyboard model matches the actual button behaviour). */}
      <div
        role="group"
        aria-label="Versions"
        className="flex max-h-[22rem] min-w-0 flex-col gap-1 overflow-y-auto rounded-[var(--radius-md)] bg-secondary/50 p-1"
      >
        {versions.map((version) => {
          const active = version.id === selected?.id;
          return (
            <button
              key={version.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect?.(version.id)}
              className={cn(
                'flex flex-col gap-1 rounded-[var(--radius-sm)] border px-2.5 py-2 text-left outline-none transition-colors',
                'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                active
                  ? 'border-border bg-card shadow-xs'
                  : 'border-transparent hover:bg-card/60',
              )}
            >
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[calc(13px*var(--font-scale))] font-semibold text-foreground">
                  {version.label}
                </span>
                {version.isActive ? (
                  <StatusBadge tone="success" dot>
                    Active
                  </StatusBadge>
                ) : version.status ? (
                  <StatusBadge tone={version.tone ?? 'neutral'}>
                    {version.status}
                  </StatusBadge>
                ) : null}
              </span>
              {(version.effectiveFrom || version.meta) && (
                <span className="text-[calc(11px*var(--font-scale))] text-muted-foreground">
                  {version.effectiveFrom ? (
                    <>
                      {version.effectiveFrom}
                      {version.effectiveTo ? ` – ${version.effectiveTo}` : ' →'}
                    </>
                  ) : null}
                  {version.effectiveFrom && version.meta ? ' · ' : ''}
                  {version.meta}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Detail / compare pane */}
      <div className="flex min-w-0 flex-col gap-3">
        {compareRows ? (
          <CompareTable title={compareTitle} rows={compareRows} />
        ) : selected ? (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="min-w-0 flex-1 truncate font-display text-[calc(17px*var(--font-scale))] font-semibold text-foreground">
                {selected.label}
              </h3>
              {selected.isActive ? (
                <StatusBadge tone="success" dot>
                  Active version
                </StatusBadge>
              ) : null}
            </div>
            {(selected.effectiveFrom || selected.meta) && (
              <p className="text-[calc(12.5px*var(--font-scale))] text-muted-foreground">
                {selected.effectiveFrom ? (
                  <>
                    Effective {selected.effectiveFrom}
                    {selected.effectiveTo
                      ? ` until ${selected.effectiveTo}`
                      : ''}
                  </>
                ) : null}
                {selected.effectiveFrom && selected.meta ? ' · ' : ''}
                {selected.meta}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onClone?.(selected.id)}
              >
                <Copy className="size-4" /> Clone to draft
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCompare?.(selected.id)}
              >
                <GitCompare className="size-4" /> Compare
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={selected.isActive}
                onClick={() => onActivate?.(selected.id)}
              >
                <Power className="size-4" />
                {selected.isActive ? 'Activated' : 'Activate'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[calc(12.5px*var(--font-scale))] text-muted-foreground">
            No versions yet.
          </p>
        )}
      </div>
    </div>
  );
}

function CompareTable({
  title,
  rows,
}: {
  title?: string;
  rows: PolicyCompareRow[];
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {title ? (
        <h3 className="font-display text-[calc(15px*var(--font-scale))] font-semibold text-foreground">
          {title}
        </h3>
      ) : null}
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border">
        <table className="w-full border-collapse text-[calc(12.5px*var(--font-scale))]">
          <thead>
            <tr className="bg-secondary/60 text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-semibold">Field</th>
              <th className="px-3 py-1.5 text-left font-semibold">Before</th>
              <th className="px-3 py-1.5 text-left font-semibold">After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={cn(
                  'border-t border-border align-top',
                  row.changed && 'bg-warning/8',
                )}
              >
                <th
                  scope="row"
                  className="px-3 py-1.5 text-left font-medium text-foreground"
                >
                  <span className="flex items-center gap-1.5">
                    {row.label}
                    {row.changed ? (
                      <span className="rounded-full border border-warning/45 bg-warning/15 px-1.5 text-[calc(10px*var(--font-scale))] font-semibold text-warning">
                        changed
                      </span>
                    ) : null}
                  </span>
                </th>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {row.before ?? <span aria-hidden>—</span>}
                </td>
                <td
                  className={cn(
                    'px-3 py-1.5',
                    row.changed
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {row.after ?? <span aria-hidden>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
