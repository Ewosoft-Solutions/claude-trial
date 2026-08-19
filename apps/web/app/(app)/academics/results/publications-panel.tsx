'use client';

/**
 * WB4 · Publish + amend panel. Validate completeness, submit for publish approval
 * (maker), approve + publish as a second approver (maker ≠ checker), then view the
 * immutable snapshot — per-student results + a checksum-addressed report card
 * rendered from the snapshot. Corrections are amendments (a new version).
 */
import * as React from 'react';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

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
import type { StateTone } from '@workspace/ui/types/states.types';
import { ApprovalPanel } from '@workspace/ui/custom/approval/approval-panel';

import { apiGet, apiPost } from './results-api';
import type { CycleComponent, ResultCycle } from './results-workbench';
import { Dot } from '@workspace/ui/custom/data-display/dot';

interface Validation {
  expectedCells: number;
  entered: number;
  missing: number;
  absent: number;
  exempt: number;
  complete: boolean;
  studentCount: number;
}
interface PublicationSummary {
  id: string;
  version: number;
  status: string;
  checksum: string;
  amendmentReason: string | null;
  publishedAt: string;
}
interface SnapshotSubject {
  subjectOfferingId: string;
  subjectLabel: string;
  components: {
    key: string;
    label: string;
    score: number | null;
    max: number;
    isAbsent: boolean;
    isExempt: boolean;
  }[];
  total: number | null;
  maxTotal: number | null;
  percentage: number | null;
  letterGrade: string | null;
  remark: string | null;
}
interface StudentResult {
  id: string;
  studentId: string;
  studentNumber: string | null;
  studentName: string | null;
  sectionLabel: string | null;
  subjects: SnapshotSubject[];
  average: number | null;
  overallGrade: string | null;
  position: number | null;
  promotionRecommendation: string | null;
  promotionReason: string | null;
  checksum: string;
  visibleToGuardian: boolean;
}
interface Amendment {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
}

const REC_TONE: Record<string, StateTone> = {
  promote: 'success',
  review: 'warning',
  repeat: 'destructive',
};

export function PublicationsPanel({
  cycle,
  canManage,
  canApprove,
  components,
  onChanged,
}: {
  cycle: ResultCycle;
  canManage: boolean;
  canApprove: boolean;
  components: CycleComponent[];
  onChanged: () => Promise<void> | void;
}) {
  const [validation, setValidation] = React.useState<Validation | null>(null);
  const [publications, setPublications] = React.useState<PublicationSummary[]>(
    [],
  );
  const [amendments, setAmendments] = React.useState<Amendment[]>([]);
  const [selectedPub, setSelectedPub] = React.useState<string>('');
  const [students, setStudents] = React.useState<StudentResult[]>([]);
  const [openStudent, setOpenStudent] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);

  const loadPublications = React.useCallback(async () => {
    try {
      const [pubs, amends] = await Promise.all([
        apiGet<PublicationSummary[]>(`/cycles/${cycle.id}/publications`),
        apiGet<Amendment[]>(`/cycles/${cycle.id}/amendments`),
      ]);
      const pubList = Array.isArray(pubs) ? pubs : [];
      setPublications(pubList);
      setAmendments(Array.isArray(amends) ? amends : []);
      if (pubList.length && !selectedPub) setSelectedPub(pubList[0]!.id);
    } catch {
      /* reads are permission-gated; leave empty */
    }
  }, [cycle.id, selectedPub]);

  React.useEffect(() => {
    if (cycle.status === 'published') void loadPublications();
  }, [cycle.status, loadPublications]);

  React.useEffect(() => {
    if (!selectedPub) return;
    void (async () => {
      try {
        const data = await apiGet<{ students: StudentResult[] }>(
          `/publications/${selectedPub}`,
        );
        setStudents(Array.isArray(data?.students) ? data.students : []);
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : 'Could not load publication',
        );
      }
    })();
  }, [selectedPub]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await onChanged();
      if (cycle.status === 'published') await loadPublications();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  async function validate() {
    setBusy(true);
    try {
      setValidation(await apiGet<Validation>(`/cycles/${cycle.id}/validate`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not validate');
    } finally {
      setBusy(false);
    }
  }

  const status = cycle.status;

  return (
    <div className="flex flex-col gap-6">
      {/* Validation */}
      {[
        'entry_open',
        'entry_closed',
        'moderation',
        'pending_approval',
      ].includes(status) && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={validate} disabled={busy}>
              Validate completeness
            </Button>
            {validation &&
              (validation.complete ? (
                <span className="flex items-center gap-1 text-sm text-[var(--success,green)]">
                  <CheckCircle2 className="size-4" /> Complete
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm text-[var(--warning,orange)]">
                  <AlertTriangle className="size-4" /> {validation.missing}{' '}
                  missing
                </span>
              ))}
          </div>
          {validation && (
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <Stat label="Students" value={validation.studentCount} />
              <Stat label="Cells" value={validation.expectedCells} />
              <Stat label="Entered" value={validation.entered} />
              <Stat label="Absent" value={validation.absent} />
              <Stat label="Missing" value={validation.missing} />
            </div>
          )}
        </section>
      )}

      {/* Publish actions */}
      {canManage && (status === 'moderation' || status === 'entry_closed') && (
        <Button
          onClick={() =>
            run(
              () => apiPost(`/cycles/${cycle.id}/request-publish`),
              'Submitted for publish approval',
            )
          }
          disabled={busy}
        >
          Submit for publish approval
        </Button>
      )}

      {status === 'pending_approval' && (
        <ApprovalPanel
          request={{
            title: `Publish ${cycle.name}`,
            requestedBy: 'a colleague',
            reason: 'Publishing produces an immutable, reproducible snapshot.',
            riskLabel: 'Result publication',
          }}
          canApprove={canApprove}
          stepUpRequired={false}
          onApprove={
            canApprove
              ? () =>
                  void run(
                    () => apiPost(`/cycles/${cycle.id}/approve-publish`, {}),
                    'Results published',
                  )
              : undefined
          }
        />
      )}

      {/* Published snapshot */}
      {status === 'published' && (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Label>Publication</Label>
              <Select value={selectedPub} onValueChange={setSelectedPub}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Choose a version" />
                </SelectTrigger>
                <SelectContent>
                  {publications.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      v{p.version}
                      <Dot />
                      {p.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPubMeta(publications, selectedPub) && (
                <span className="font-mono text-xs text-muted-foreground">
                  sha256:
                  {selectedPubMeta(publications, selectedPub)!.checksum.slice(
                    0,
                    16,
                  )}
                  …
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Student</th>
                    <th className="px-2 py-2 font-medium">Average</th>
                    <th className="px-2 py-2 font-medium">Grade</th>
                    <th className="px-2 py-2 font-medium">Promotion</th>
                    <th className="px-2 py-2 font-medium">Guardian</th>
                    <th className="px-2 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <React.Fragment key={s.id}>
                      <tr className="border-b last:border-0">
                        <td className="px-2 py-2">
                          <div className="font-medium">{s.studentName}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.studentNumber}
                            {s.sectionLabel ? ` · ${s.sectionLabel}` : ''}
                            {s.position ? ` · pos ${s.position}` : ''}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          {s.average === null ? '—' : `${s.average}%`}
                        </td>
                        <td className="px-2 py-2">{s.overallGrade ?? '—'}</td>
                        <td className="px-2 py-2">
                          <StatusBadge
                            tone={
                              REC_TONE[s.promotionRecommendation ?? 'review'] ??
                              'neutral'
                            }
                          >
                            {s.promotionRecommendation ?? '—'}
                          </StatusBadge>
                        </td>
                        <td className="px-2 py-2">
                          {s.visibleToGuardian ? (
                            'Visible'
                          ) : (
                            <StatusBadge tone="warning">On hold</StatusBadge>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setOpenStudent((cur) =>
                                cur === s.id ? '' : s.id,
                              )
                            }
                          >
                            {openStudent === s.id ? 'Hide' : 'Report card'}
                          </Button>
                        </td>
                      </tr>
                      {openStudent === s.id && (
                        <tr>
                          <td colSpan={6} className="bg-muted/30 px-2 py-3">
                            <ReportCard student={s} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Amendment */}
          {canManage && (
            <AmendmentForm
              cycleId={cycle.id}
              components={components}
              students={students}
              onDone={loadPublications}
            />
          )}
          {amendments.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Amendments</h3>
              {amendments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-sm border p-2 text-sm"
                >
                  <div>
                    <StatusBadge
                      tone={a.status === 'applied' ? 'success' : 'warning'}
                    >
                      {a.status.replace(/_/g, ' ')}
                    </StatusBadge>{' '}
                    {a.reason}
                  </div>
                  {a.status === 'pending_approval' && canApprove && (
                    <Button
                      size="sm"
                      onClick={() =>
                        run(
                          () => apiPost(`/amendments/${a.id}/approve`, {}),
                          'Amendment applied (new version)',
                        )
                      }
                      disabled={busy}
                    >
                      Approve amendment
                    </Button>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function selectedPubMeta(pubs: PublicationSummary[], id: string) {
  return pubs.find((p) => p.id === id) ?? null;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function ReportCard({ student }: { student: StudentResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-2 py-1 font-medium">Subject</th>
            <th className="px-2 py-1 font-medium">Total</th>
            <th className="px-2 py-1 font-medium">%</th>
            <th className="px-2 py-1 font-medium">Grade</th>
            <th className="px-2 py-1 font-medium">Remark</th>
          </tr>
        </thead>
        <tbody>
          {student.subjects.map((sub) => {
            const abs =
              sub.percentage === null &&
              !sub.components.every((c) => c.isExempt);
            const exm =
              sub.components.length > 0 &&
              sub.components.every((c) => c.isExempt);
            return (
              <tr
                key={sub.subjectOfferingId}
                className="border-b last:border-0"
              >
                <td className="px-2 py-1">{sub.subjectLabel}</td>
                <td className="px-2 py-1">
                  {sub.total === null ? '—' : `${sub.total}/${sub.maxTotal}`}
                </td>
                <td className="px-2 py-1">
                  {sub.percentage === null
                    ? exm
                      ? 'EXM'
                      : abs
                        ? 'ABS'
                        : '—'
                    : `${sub.percentage}%`}
                </td>
                <td className="px-2 py-1">{sub.letterGrade ?? '—'}</td>
                <td className="px-2 py-1 text-muted-foreground">
                  {sub.remark ?? ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {student.promotionReason && (
        <p className="mt-2 text-xs text-muted-foreground">
          Promotion: {student.promotionRecommendation} —{' '}
          {student.promotionReason}
        </p>
      )}
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        sha256:{student.checksum.slice(0, 24)}…
      </p>
    </div>
  );
}

function AmendmentForm({
  cycleId,
  components,
  students,
  onDone,
}: {
  cycleId: string;
  components: CycleComponent[];
  students: StudentResult[];
  onDone: () => Promise<void> | void;
}) {
  const [open, setOpen] = React.useState(false);
  const [studentId, setStudentId] = React.useState('');
  const [offeringId, setOfferingId] = React.useState('');
  const [componentKey, setComponentKey] = React.useState('');
  const [score, setScore] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const student = students.find((s) => s.studentId === studentId);
  const subjects = student?.subjects ?? [];

  async function submit() {
    setBusy(true);
    try {
      await apiPost(`/cycles/${cycleId}/amendments`, {
        reason,
        changes: [
          {
            studentId,
            subjectOfferingId: offeringId,
            componentKey,
            score: score === '' ? null : Number(score),
          },
        ],
      });
      toast.success('Amendment submitted for approval');
      setOpen(false);
      setStudentId('');
      setOfferingId('');
      setComponentKey('');
      setScore('');
      setReason('');
      await onDone();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Could not submit amendment',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Request a correction (amendment)
        </Button>
      </div>
    );
  }

  const canSubmit = studentId && offeringId && componentKey && reason.trim();

  return (
    <section className="flex flex-col gap-3 rounded-sm border p-3">
      <h3 className="text-sm font-semibold">Request a correction</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Student</Label>
          <Select
            value={studentId}
            onValueChange={(v) => {
              setStudentId(v);
              setOfferingId('');
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.studentId} value={s.studentId}>
                  {s.studentName} ({s.studentNumber})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Subject</Label>
          <Select
            value={offeringId}
            onValueChange={setOfferingId}
            disabled={!studentId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((sub) => (
                <SelectItem
                  key={sub.subjectOfferingId}
                  value={sub.subjectOfferingId}
                >
                  {sub.subjectLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Component</Label>
          <Select value={componentKey} onValueChange={setComponentKey}>
            <SelectTrigger>
              <SelectValue placeholder="Choose" />
            </SelectTrigger>
            <SelectContent>
              {components.map((c) => (
                <SelectItem key={c.id} value={c.key}>
                  {c.label} ({c.key})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>New score</Label>
          <Input
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="Leave blank for absent"
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Reason</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this published result is being corrected"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={busy || !canSubmit}>
          Submit amendment
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
