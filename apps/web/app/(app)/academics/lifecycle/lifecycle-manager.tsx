'use client';

/**
 * WB2-3 · Student lifecycle manager (client).
 *
 * Pick a student to see their current placement and full year-over-year history
 * (durable spans — nothing is overwritten). The register / transfer / withdraw /
 * graduate controls write through /api/academics/lifecycle/* (permissions +
 * campus scope enforced server-side).
 */
import * as React from 'react';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  GraduationCap,
  History,
  LogOut,
  UserPlus,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import { Input } from '@workspace/ui/components/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

export interface SectionOption {
  id: string;
  displayLabel: string;
}
export interface YearOption {
  id: string;
  name: string;
}
export interface StudentOption {
  id: string;
  studentNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}

interface HistoryRow {
  id: string;
  eventType: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
  campusName: string | null;
  sectionLabel: string | null;
}
interface Placement {
  student: {
    studentNumber: string;
    enrollmentStatus: string;
  };
  current: HistoryRow | null;
  history: HistoryRow[];
}

function studentLabel(s: StudentOption): string {
  const name =
    s.name ||
    [s.firstName, s.lastName].filter(Boolean).join(' ') ||
    s.studentNumber ||
    s.id;
  return s.studentNumber && name !== s.studentNumber
    ? `${name} (${s.studentNumber})`
    : name;
}

function fmt(date: string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const STATUS_TONE: Record<string, StateTone> = {
  active: 'success',
  transferred: 'info',
  withdrawn: 'warning',
  graduated: 'info',
  inactive: 'neutral',
  suspended: 'destructive',
};

const EVENT_TONE: Record<string, StateTone> = {
  registration: 'success',
  transfer: 'info',
  promotion: 'info',
  withdrawal: 'warning',
  graduation: 'info',
  reinstatement: 'success',
};

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as {
      message?: string | string[];
      error?: string;
    };
    const m = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message;
    return m || data.error || fallback;
  } catch {
    return fallback;
  }
}

export function LifecycleManager({
  canManage,
  sections,
  years,
  students,
}: {
  canManage: boolean;
  sections: SectionOption[];
  years: YearOption[];
  students: StudentOption[];
}) {
  const [studentId, setStudentId] = React.useState('');
  const [placement, setPlacement] = React.useState<Placement | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Register form
  const [regSection, setRegSection] = React.useState('');
  const [regYear, setRegYear] = React.useState('');
  // Transfer form
  const [toSection, setToSection] = React.useState('');
  const [transferReason, setTransferReason] = React.useState('');
  // Withdraw form
  const [withdrawReason, setWithdrawReason] = React.useState('');

  const loadPlacement = React.useCallback(async (id: string) => {
    if (!id) return;
    setBusy(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/academics/lifecycle/students/${id}/placement`,
      );
      if (!res.ok) {
        setPlacement(null);
        setLoadError(await errorMessage(res, 'Could not load placement'));
        return;
      }
      setPlacement((await res.json()) as Placement);
    } catch {
      setLoadError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (studentId) void loadPlacement(studentId);
    else setPlacement(null);
  }, [studentId, loadPlacement]);

  async function act(
    path: string,
    body: Record<string, unknown>,
    okMsg: string,
  ) {
    setBusy(true);
    try {
      const res = await fetch(`/api/academics/lifecycle/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, ...body }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, `Could not ${path}`));
        return;
      }
      toast.success(okMsg);
      await loadPlacement(studentId);
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const hasPlacement = Boolean(placement?.current);
  const status = placement?.student.enrollmentStatus;
  const inactive = status === 'withdrawn' || status === 'graduated';

  return (
    <div className="flex flex-col gap-6">
      {/* Student picker */}
      <Card>
        <CardHeader>
          <CardTitle>Choose a student</CardTitle>
          <CardDescription>
            See where they sit now and the history behind it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students to show.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 sm:max-w-sm">
              <Label htmlFor="lc-student">Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="lc-student">
                  <SelectValue placeholder="Choose student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {studentLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {loadError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {loadError}
            </p>
          )}
        </CardContent>
      </Card>

      {placement && (
        <>
          {/* Current placement + history */}
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <History className="size-4" aria-hidden /> Placement &amp;
                history
                <StatusBadge tone={STATUS_TONE[status ?? ''] ?? 'neutral'}>
                  {status ?? 'unknown'}
                </StatusBadge>
              </CardTitle>
              <CardDescription>
                {placement.current
                  ? `Currently in ${placement.current.sectionLabel ?? '—'}${
                      placement.current.campusName
                        ? ` · ${placement.current.campusName}`
                        : ''
                    }`
                  : 'No active placement.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {placement.history.length === 0 ? (
                <EmptyState
                  title="No history yet"
                  description="Register this student into a section to start their history."
                />
              ) : (
                <ol className="flex flex-col gap-0">
                  {placement.history.map((h, i) => (
                    <li
                      key={h.id}
                      className="flex gap-3 border-l-2 border-border pb-4 pl-4 last:pb-0"
                    >
                      <div className="flex flex-1 flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            tone={EVENT_TONE[h.eventType] ?? 'neutral'}
                          >
                            {h.eventType}
                          </StatusBadge>
                          {h.sectionLabel && (
                            <span className="text-sm font-medium">
                              {h.sectionLabel}
                            </span>
                          )}
                          {h.campusName && (
                            <span className="text-xs text-muted-foreground">
                              {h.campusName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fmt(h.effectiveFrom)} →{' '}
                          {h.effectiveTo ? fmt(h.effectiveTo) : 'present'}
                          {h.reason ? ` · ${h.reason}` : ''}
                        </p>
                      </div>
                      <span className="sr-only">
                        {h.status === 'active' ? 'current' : 'past'} placement,
                        step {i + 1}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Transitions */}
          {canManage && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Register (no current placement) */}
              {!hasPlacement && !inactive && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="size-4" aria-hidden /> Register
                    </CardTitle>
                    <CardDescription>
                      Place the student into their first section.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="reg-section">Section</Label>
                      <Select value={regSection} onValueChange={setRegSection}>
                        <SelectTrigger id="reg-section">
                          <SelectValue placeholder="Choose section" />
                        </SelectTrigger>
                        <SelectContent>
                          {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.displayLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="reg-year">Academic year</Label>
                      <Select value={regYear} onValueChange={setRegYear}>
                        <SelectTrigger id="reg-year">
                          <SelectValue placeholder="Choose year" />
                        </SelectTrigger>
                        <SelectContent>
                          {years.map((y) => (
                            <SelectItem key={y.id} value={y.id}>
                              {y.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() =>
                        act(
                          'register',
                          {
                            classSectionId: regSection,
                            academicYearId: regYear,
                          },
                          'Student registered',
                        )
                      }
                      disabled={busy || !regSection || !regYear}
                    >
                      Register student
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Transfer (has a placement) */}
              {hasPlacement && !inactive && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowRightLeft className="size-4" aria-hidden /> Transfer
                    </CardTitle>
                    <CardDescription>
                      Move to another section — the current placement is kept
                      with an end date.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="tr-section">Destination section</Label>
                      <Select value={toSection} onValueChange={setToSection}>
                        <SelectTrigger id="tr-section">
                          <SelectValue placeholder="Choose section" />
                        </SelectTrigger>
                        <SelectContent>
                          {sections.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.displayLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="tr-reason">Reason</Label>
                      <Input
                        id="tr-reason"
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        placeholder="Why the transfer?"
                      />
                    </div>
                    <Button
                      onClick={() =>
                        act(
                          'transfer',
                          {
                            toClassSectionId: toSection,
                            reason: transferReason,
                          },
                          'Student transferred',
                        )
                      }
                      disabled={busy || !toSection || !transferReason.trim()}
                    >
                      Transfer student
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Withdraw / graduate */}
              {!inactive && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LogOut className="size-4" aria-hidden /> Exit
                    </CardTitle>
                    <CardDescription>
                      Withdraw or graduate — the lifecycle state flips; history
                      is kept.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="wd-reason">Reason</Label>
                      <Input
                        id="wd-reason"
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                        placeholder="Reason (required to withdraw)"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          act(
                            'withdraw',
                            { reason: withdrawReason },
                            'Student withdrawn',
                          )
                        }
                        disabled={busy || !withdrawReason.trim()}
                      >
                        Withdraw
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          act(
                            'graduate',
                            { reason: withdrawReason || undefined },
                            'Student graduated',
                          )
                        }
                        disabled={busy}
                      >
                        <GraduationCap className="mr-1 size-4" aria-hidden />
                        Graduate
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {inactive && (
                <Card>
                  <CardHeader>
                    <CardTitle>Lifecycle closed</CardTitle>
                    <CardDescription>
                      This student is {status}. Their placement history above is
                      preserved.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
