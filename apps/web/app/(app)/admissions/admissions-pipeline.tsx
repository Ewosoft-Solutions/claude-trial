'use client';

/**
 * WB3 · Admissions pipeline (client).
 *
 * Submit applications, move them through the stage machine, record scored
 * reviews, offer/accept/reject, and — in one command — convert an accepted
 * applicant into a registered student (enrolled into a section via the WB2-3
 * lifecycle). Writes go through /api/admissions/* (permissions + campus scope
 * enforced server-side).
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GraduationCap, Inbox, Plus, UserCheck } from 'lucide-react';

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

export interface Application {
  id: string;
  applicantName: string;
  applyingFor: string;
  guardianName: string;
  guardianEmail?: string | null;
  stage: string;
  decision: string;
  resultingStudentId?: string | null;
}
export interface SectionOption {
  id: string;
  displayLabel: string;
}
export interface YearOption {
  id: string;
  name: string;
}
interface StageEvent {
  id: string;
  fromStage: string | null;
  toStage: string;
  note: string | null;
  createdAt: string;
}
interface Review {
  id: string;
  score: number | null;
  recommendation: string;
  note: string | null;
  createdAt: string;
}
interface ApplicationDetail extends Application {
  stageEvents: StageEvent[];
  reviews: Review[];
}

export interface Perms {
  create: boolean;
  review: boolean;
  approve: boolean;
  reject: boolean;
  convert: boolean;
}

const ADVANCE_STAGES = [
  'enquiry',
  'applied',
  'screening',
  'interview',
  'withdrawn',
] as const;
const RECOMMENDATIONS = ['recommend', 'waitlist', 'reject', 'hold'] as const;

const STAGE_TONE: Record<string, StateTone> = {
  enquiry: 'neutral',
  applied: 'info',
  screening: 'info',
  interview: 'info',
  offer: 'warning',
  accepted: 'success',
  enrolled: 'success',
  rejected: 'destructive',
  withdrawn: 'neutral',
};

function fmt(date: string): string {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

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

export function AdmissionsPipeline({
  perms,
  applications,
  sections,
  years,
}: {
  perms: Perms;
  applications: Application[];
  sections: SectionOption[];
  years: YearOption[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState('');
  const [detail, setDetail] = React.useState<ApplicationDetail | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Create form
  const [name, setName] = React.useState('');
  const [applyingFor, setApplyingFor] = React.useState('');
  const [guardianName, setGuardianName] = React.useState('');
  const [guardianEmail, setGuardianEmail] = React.useState('');

  // Review form
  const [score, setScore] = React.useState('');
  const [recommendation, setRecommendation] = React.useState('recommend');
  // Offer / convert target
  const [sectionId, setSectionId] = React.useState('');
  const [yearId, setYearId] = React.useState('');

  const loadDetail = React.useCallback(async (id: string) => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions/applications/${id}`);
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not load application'));
        return;
      }
      setDetail((await res.json()) as ApplicationDetail);
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  React.useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function post(
    path: string,
    body: Record<string, unknown> | undefined,
    okMsg: string,
  ) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admissions/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Action failed'));
        return null;
      }
      const data = (await res.json()) as unknown;
      toast.success(okMsg);
      if (selectedId) await loadDetail(selectedId);
      router.refresh();
      return data;
    } catch {
      toast.error('Network error — please try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createApplication() {
    const data = await post(
      'applications',
      {
        applicantName: name,
        applyingFor,
        guardianName,
        guardianEmail: guardianEmail || undefined,
      },
      'Application submitted',
    );
    if (data && typeof data === 'object' && 'id' in data) {
      setName('');
      setApplyingFor('');
      setGuardianName('');
      setGuardianEmail('');
      setSelectedId((data as { id: string }).id);
    }
  }

  const stage = detail?.stage;
  const terminal =
    stage === 'enrolled' || stage === 'rejected' || stage === 'withdrawn';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
      {/* Left: create + list */}
      <div className="flex flex-col gap-6">
        {perms.create && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-4" aria-hidden /> New application
              </CardTitle>
              <CardDescription>Submit a prospective student.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-name">Applicant name</Label>
                <Input
                  id="ad-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ada Okoro"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-for">Applying for</Label>
                <Input
                  id="ad-for"
                  value={applyingFor}
                  onChange={(e) => setApplyingFor(e.target.value)}
                  placeholder="e.g. Primary 5"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-guardian">Guardian name</Label>
                <Input
                  id="ad-guardian"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="e.g. Mrs Okoro"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-email">Guardian email (optional)</Label>
                <Input
                  id="ad-email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="guardian@example.com"
                />
              </div>
              <Button
                onClick={createApplication}
                disabled={
                  busy ||
                  !name.trim() ||
                  !applyingFor.trim() ||
                  !guardianName.trim()
                }
              >
                Submit application
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="size-4" aria-hidden /> Applications
            </CardTitle>
            <CardDescription>Select one to review and decide.</CardDescription>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <EmptyState
                title="No applications yet"
                description="Submitted applications appear here."
              />
            ) : (
              <ul className="flex flex-col divide-y rounded-md border">
                {applications.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      aria-current={a.id === selectedId ? 'true' : undefined}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/50 ${
                        a.id === selectedId ? 'bg-muted/60' : ''
                      }`}
                    >
                      <span className="flex flex-col">
                        <span className="font-medium">{a.applicantName}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.applyingFor}
                        </span>
                      </span>
                      <StatusBadge tone={STAGE_TONE[a.stage] ?? 'neutral'}>
                        {a.stage}
                      </StatusBadge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: detail */}
      <div className="flex flex-col gap-6">
        {!detail ? (
          <Card>
            <CardContent className="py-10">
              <EmptyState
                title="Select an application"
                description="Its stage history, reviews and decision actions appear here."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {detail.applicantName}
                  <StatusBadge tone={STAGE_TONE[detail.stage] ?? 'neutral'}>
                    {detail.stage}
                  </StatusBadge>
                </CardTitle>
                <CardDescription>
                  Applying for {detail.applyingFor} · guardian{' '}
                  {detail.guardianName}
                  {detail.resultingStudentId ? ' · enrolled as a student' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Stage history */}
                <div>
                  <p className="mb-2 text-sm font-semibold">Stage history</p>
                  <ol className="flex flex-col gap-0">
                    {detail.stageEvents.map((e) => (
                      <li
                        key={e.id}
                        className="flex gap-3 border-l-2 border-border pb-3 pl-4 last:pb-0"
                      >
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              tone={STAGE_TONE[e.toStage] ?? 'neutral'}
                            >
                              {e.toStage}
                            </StatusBadge>
                            <span className="text-xs text-muted-foreground">
                              {fmt(e.createdAt)}
                            </span>
                          </div>
                          {e.note && (
                            <span className="text-xs text-muted-foreground">
                              {e.note}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Reviews */}
                <div>
                  <p className="mb-2 text-sm font-semibold">Reviews</p>
                  {detail.reviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No reviews yet.
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y rounded-md border">
                      {detail.reviews.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <span>
                            {r.recommendation}
                            {r.note ? ` — ${r.note}` : ''}
                          </span>
                          {r.score != null && (
                            <StatusBadge tone="info">{r.score}</StatusBadge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            {!terminal && (
              <Card>
                <CardHeader>
                  <CardTitle>Decision</CardTitle>
                  <CardDescription>
                    Advance, review, offer, accept, reject — or convert to a
                    student.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  {/* Advance + review */}
                  {perms.review && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex flex-col gap-1.5">
                          <Label>Advance to</Label>
                          <Select
                            onValueChange={(v) =>
                              void post(
                                `applications/${detail.id}/advance`,
                                { toStage: v },
                                `Moved to ${v}`,
                              )
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Choose stage" />
                            </SelectTrigger>
                            <SelectContent>
                              {ADVANCE_STAGES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="rv-score">Score</Label>
                          <Input
                            id="rv-score"
                            className="w-24"
                            value={score}
                            onChange={(e) => setScore(e.target.value)}
                            placeholder="0–100"
                            inputMode="numeric"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Label>Recommendation</Label>
                          <Select
                            value={recommendation}
                            onValueChange={setRecommendation}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RECOMMENDATIONS.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            const s = score.trim() ? Number(score) : undefined;
                            void post(
                              `applications/${detail.id}/reviews`,
                              { recommendation, score: s },
                              'Review added',
                            ).then(() => setScore(''));
                          }}
                        >
                          Add review
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Offer target (section + year) */}
                  {(perms.approve || perms.convert) && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <Label>Target section</Label>
                        <Select value={sectionId} onValueChange={setSectionId}>
                          <SelectTrigger>
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
                        <Label>Academic year</Label>
                        <Select value={yearId} onValueChange={setYearId}>
                          <SelectTrigger>
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
                    </div>
                  )}

                  {/* Decision buttons */}
                  <div className="flex flex-wrap gap-2">
                    {perms.approve &&
                      stage !== 'offer' &&
                      stage !== 'accepted' && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void post(
                              `applications/${detail.id}/offer`,
                              {
                                targetClassSectionId: sectionId || undefined,
                                academicYearId: yearId || undefined,
                              },
                              'Place offered',
                            )
                          }
                        >
                          Offer a place
                        </Button>
                      )}
                    {perms.approve && stage === 'offer' && (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void post(
                            `applications/${detail.id}/accept`,
                            undefined,
                            'Offer accepted',
                          )
                        }
                      >
                        <UserCheck className="mr-1 size-4" aria-hidden />
                        Record acceptance
                      </Button>
                    )}
                    {perms.convert && stage === 'accepted' && (
                      <Button
                        disabled={busy || !sectionId || !yearId}
                        onClick={() =>
                          void post(
                            `applications/${detail.id}/convert`,
                            {
                              classSectionId: sectionId,
                              academicYearId: yearId,
                            },
                            'Converted to a registered student',
                          )
                        }
                      >
                        <GraduationCap className="mr-1 size-4" aria-hidden />
                        Convert to student
                      </Button>
                    )}
                    {perms.reject && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void post(
                            `applications/${detail.id}/reject`,
                            undefined,
                            'Application rejected',
                          )
                        }
                      >
                        Reject
                      </Button>
                    )}
                  </div>
                  {perms.convert && stage === 'accepted' && (
                    <p className="text-xs text-muted-foreground">
                      Converting creates the student record and enrols them into
                      the chosen section.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
