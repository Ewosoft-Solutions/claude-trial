'use client';

/**
 * WB3 structured-intake · full application detail.
 *
 * Applicant profile + guardians + the staged requirement checklist, plus the
 * stage history, scored reviews, and — promoted to the top — the decision
 * actions (advance / review / offer / accept / reject / convert) and an Edit
 * applicant sheet. Writes go through /api/admissions/*; permissions + campus
 * scope are enforced server-side.
 */
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  GraduationCap,
  Link2,
  Pencil,
  UserCheck,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
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
import { Sheet, SheetDescription } from '@workspace/ui/components/sheet';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import {
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/custom/detail/drawer-chrome';

import { RequirementsPanel } from './requirements-panel';
import { FormResponsePanel } from './form-response-panel';
import { InterviewsPanel } from './interviews-panel';
import { EditApplicationForm } from './edit-application-form';
import {
  errorMessage,
  fmtDate,
  type ApplicationDetail,
  type FormResponse,
  type FormVersion,
  type Interview,
  type Perms,
  type SectionOption,
  type YearOption,
} from '../admissions-types';
import {
  StageBadge,
  DecisionBadge,
  STAGE_LABEL,
  titleCase,
} from '@/lib/admissions/status';

const ADVANCE_STAGES = [
  'enquiry',
  'applied',
  'screening',
  'interview',
  'withdrawn',
] as const;
const RECOMMENDATIONS = ['recommend', 'waitlist', 'reject', 'hold'] as const;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

export function ApplicationDetailView({
  detail,
  perms,
  sections,
  years,
  configByRequirementId,
  resolvedFeeByRequirementId,
  currentForm,
  formResponse,
  interviews,
}: {
  detail: ApplicationDetail;
  perms: Perms;
  sections: SectionOption[];
  years: YearOption[];
  configByRequirementId: Record<string, Record<string, unknown> | undefined>;
  resolvedFeeByRequirementId: Record<string, number | null>;
  currentForm: FormVersion | null;
  formResponse: FormResponse | null;
  interviews: Interview[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [score, setScore] = React.useState('');
  const [recommendation, setRecommendation] = React.useState('recommend');
  // Seed the offer/convert target from what the offer already recorded, so the
  // convert button isn't stuck disabled after a page refresh.
  const [sectionId, setSectionId] = React.useState(
    detail.targetClassSectionId ?? '',
  );
  const [yearId, setYearId] = React.useState(detail.academicYearId ?? '');

  const stage = detail.stage;
  const terminal =
    stage === 'enrolled' || stage === 'rejected' || stage === 'withdrawn';
  const canDecide =
    perms.review || perms.approve || perms.reject || perms.convert;

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
        return;
      }
      toast.success(okMsg);
      router.refresh();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Mint a SecureLink status-portal token and copy the applicant's tracking URL.
  async function copyPortalLink() {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admissions/applications/${detail.id}/portal-link`,
        { method: 'POST' },
      );
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not create a portal link'));
        return;
      }
      const { statusToken } = (await res.json()) as { statusToken: string };
      const url = `${window.location.origin}/status/${statusToken}`;
      await navigator.clipboard?.writeText(url);
      toast.success('Applicant portal link copied to clipboard');
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShellMain>
      <div className="flex flex-col gap-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href="/students/admissions">
            <ArrowLeft className="mr-1 size-4" aria-hidden /> Admissions
          </Link>
        </Button>

        {/* Header — avatar + name + stage/decision + primary actions */}
        <div className="flex flex-wrap items-start gap-3">
          <Avatar className="size-12 shrink-0">
            <AvatarFallback
              seed={detail.applicantName}
              className="text-sm font-semibold"
            >
              {initials(detail.applicantName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-[min(100%,14rem)] flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <PageTitle>{detail.applicantName}</PageTitle>
              <StageBadge stage={stage} />
              <DecisionBadge decision={detail.decision} />
            </div>
            <p className="text-sm text-muted-foreground">
              Applying for {detail.applyingFor}
              {detail.resultingStudentId ? ' · enrolled as a student' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {perms.review && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="mr-1 size-4" aria-hidden /> Edit
              </Button>
            )}
            {perms.review && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void copyPortalLink()}
              >
                <Link2 className="mr-1 size-4" aria-hidden /> Portal link
              </Button>
            )}
          </div>
        </div>

        {/* Decision & actions — promoted so acting on the file is obvious. */}
        {!terminal && canDecide && (
          <Card>
            <CardHeader>
              <CardTitle>Decision &amp; actions</CardTitle>
              <CardDescription>
                Advance, review, offer, accept, reject — or convert to a
                student.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {perms.review && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>Advance to</Label>
                      <Select
                        onValueChange={(v) =>
                          void post(
                            `applications/${detail.id}/advance`,
                            { toStage: v },
                            `Moved to ${STAGE_LABEL[v] ?? v}`,
                          )
                        }
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Choose stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {ADVANCE_STAGES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STAGE_LABEL[s] ?? titleCase(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
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
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RECOMMENDATIONS.map((r) => (
                            <SelectItem key={r} value={r}>
                              {titleCase(r)}
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

              {(perms.approve || perms.convert) &&
                (sections.length === 0 || years.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
                    No {sections.length === 0 ? 'sections' : 'academic years'}{' '}
                    are available to offer or convert into. You may be missing
                    access to the academic structure — ask an administrator for
                    the “View academic structure” and schedule permissions.
                  </p>
                ) : (
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
                ))}

              <div className="flex flex-wrap gap-2">
                {perms.approve && stage !== 'offer' && stage !== 'accepted' && (
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
                        { classSectionId: sectionId, academicYearId: yearId },
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
                    className="text-destructive hover:text-destructive"
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
                  Converting creates the student record and enrols them into the
                  chosen section.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Profile + guardians */}
          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Applicant</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <Field
                    label="Date of birth"
                    value={fmtDate(detail.dateOfBirth)}
                  />
                  <Field label="Gender" value={detail.gender ?? '—'} />
                  <Field
                    label="State of origin"
                    value={detail.stateOfOrigin ?? '—'}
                  />
                  <Field label="Religion" value={detail.religion ?? '—'} />
                  <Field
                    label="Health notes"
                    value={detail.healthNotes ?? '—'}
                    wide
                  />
                  <Field label="Notes" value={detail.notes ?? '—'} wide />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Parents / guardians</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {detail.guardians.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    None recorded.
                  </p>
                ) : (
                  detail.guardians.map((g, i) => (
                    <div
                      key={g.id ?? i}
                      className="rounded-md border border-border p-3 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{g.fullName}</span>
                        <span className="text-xs capitalize text-muted-foreground">
                          {g.relationship}
                          {g.isPrimary ? ' · primary' : ''}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Phone: {g.phoneCountryCode} {g.phoneNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        WhatsApp:{' '}
                        {g.whatsappSameAsPhone
                          ? `${g.phoneCountryCode} ${g.phoneNumber} (same)`
                          : `${g.whatsappCountryCode ?? ''} ${g.whatsappNumber ?? '—'}`}
                      </div>
                      {g.email && (
                        <div className="text-xs text-muted-foreground">
                          {g.email}
                        </div>
                      )}
                      {g.address && (
                        <div className="text-xs text-muted-foreground">
                          {g.address}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Requirements */}
          <Card>
            <CardHeader>
              <CardTitle>Requirements</CardTitle>
              <CardDescription>
                Collected across the admissions journey — documents,
                measurements and fees, staged as the school configures them.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RequirementsPanel
                applicationId={detail.id}
                requirements={detail.requirements}
                configByRequirementId={configByRequirementId}
                resolvedFeeByRequirementId={resolvedFeeByRequirementId}
                canManage={perms.documents}
              />
            </CardContent>
          </Card>
        </div>

        {/* Application form (WB3-3) + Interviews/exams (WB3-4) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Application form</CardTitle>
              <CardDescription>
                The school&rsquo;s own questionnaire — typed answers captured
                against the published form version.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormResponsePanel
                applicationId={detail.id}
                form={currentForm}
                response={formResponse}
                perms={perms}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interviews &amp; exams</CardTitle>
              <CardDescription>
                Schedule interviews, screenings and exams; record outcomes and
                auto-mark the admission quiz.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InterviewsPanel
                applicationId={detail.id}
                interviews={interviews}
                canManage={perms.interviews}
              />
            </CardContent>
          </Card>
        </div>

        {/* History + reviews */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Stage history</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-0">
                {detail.stageEvents.map((e) => (
                  <li
                    key={e.id}
                    className="flex gap-3 border-l-2 border-border pb-3 pl-4 last:pb-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <StageBadge stage={e.toStage} />
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(e.createdAt)}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                <ul className="flex flex-col divide-y rounded-md border">
                  {detail.reviews.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span>
                        {titleCase(r.recommendation)}
                        {r.note ? ` — ${r.note}` : ''}
                      </span>
                      {r.score != null && (
                        <StatusBadge tone="info">{r.score}</StatusBadge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <DrawerContent>
          <DrawerHeader className="gap-1.5">
            <DrawerTitle className="pr-8">Edit applicant</DrawerTitle>
            <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
              Correct the applicant&rsquo;s profile and guardians. The class
              they&rsquo;re applying for isn&rsquo;t changed here.
            </SheetDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <EditApplicationForm
              detail={detail}
              onSaved={() => {
                setEditOpen(false);
                router.refresh();
              }}
              onCancel={() => setEditOpen(false)}
            />
          </div>
        </DrawerContent>
      </Sheet>
    </ShellMain>
  );
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`flex flex-col ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
