'use client';

/**
 * WB4 · FinancialHold panel — an explicit, audited hold on a student's result
 * visibility to guardians (ADR-04 redesign of the legacy silent per-student
 * block). Place a hold with a recorded reason; release it later. Staff always see
 * the result; only guardian/portal visibility is gated. Needs
 * `academics.results.financial_hold`.
 */
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

import { apiGet, apiPost, extractError } from './results-api';

interface Hold {
  id: string;
  studentId: string;
  status: string;
  reason: string;
  releaseReason?: string | null;
}
interface StudentOption {
  id: string;
  label: string;
}

export function FinancialHoldsPanel({ canHold }: { canHold: boolean }) {
  const [holds, setHolds] = React.useState<Hold[]>([]);
  const [studentOptions, setStudentOptions] = React.useState<StudentOption[]>(
    [],
  );
  const [studentId, setStudentId] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setHolds(await apiGet<Hold[]>('/financial-holds'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load holds');
    }
  }, []);

  React.useEffect(() => {
    void load();
    // Students for the picker (via the shared /api/students proxy).
    void (async () => {
      try {
        const res = await fetch('/api/students?limit=100');
        if (!res.ok) return;
        const body = (await res.json()) as {
          data?: {
            id: string;
            studentNumber?: string;
            user?: { firstName?: string; lastName?: string };
          }[];
        };
        const list = Array.isArray(body) ? body : (body.data ?? []);
        setStudentOptions(
          list.map((s) => ({
            id: s.id,
            label:
              `${s.user?.firstName ?? ''} ${s.user?.lastName ?? ''}`.trim() ||
              s.studentNumber ||
              s.id,
          })),
        );
      } catch {
        /* the raw-id fallback still works */
      }
    })();
  }, [load]);

  async function place() {
    setBusy(true);
    try {
      await apiPost('/financial-holds', { studentId, reason });
      toast.success('Hold placed');
      setStudentId('');
      setReason('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not place hold');
    } finally {
      setBusy(false);
    }
  }

  async function release(id: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/academics/results/financial-holds/${id}/release`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok)
        throw new Error(await extractError(res, 'Could not release'));
      toast.success('Hold released');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not release hold');
    } finally {
      setBusy(false);
    }
  }

  const labelFor = (id: string) =>
    studentOptions.find((s) => s.id === id)?.label ?? id;
  const active = holds.filter((h) => h.status === 'active');

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        A hold gates a student’s published result from their guardians until it
        is released. It is an explicit, audited decision — staff always see the
        result, and finance never silently blocks it.
      </p>

      {canHold && (
        <section className="grid grid-cols-1 gap-3 rounded-sm border p-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Student</Label>
            {studentOptions.length > 0 ? (
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a student" />
                </SelectTrigger>
                <SelectContent>
                  {studentOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Student id"
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Reason</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this hold is placed"
            />
          </div>
          <div>
            <Button
              onClick={place}
              disabled={busy || !studentId || !reason.trim()}
            >
              Place hold
            </Button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Active holds</h3>
        {active.length === 0 ? (
          <EmptyState title="No active holds" description="Nothing is gated." />
        ) : (
          active.map((h) => (
            <div
              key={h.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border p-2 text-sm"
            >
              <div>
                <StatusBadge tone="warning">On hold</StatusBadge>{' '}
                <span className="font-medium">{labelFor(h.studentId)}</span> —{' '}
                {h.reason}
              </div>
              {canHold && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => release(h.id)}
                  disabled={busy}
                >
                  Release
                </Button>
              )}
            </div>
          ))
        )}
      </section>
    </div>
  );
}
