'use client';

/**
 * WB2-2 · Enrollment manager (client).
 *
 * Enroll a student into a class section (K-12) and resolve any student's
 * subjects — the resolution runs server-side by the tenant's academic profile
 * (class vs course) and always resolves through OFFERINGS, never a typed label.
 * Writes go through /api/academics/enrollment/* (permissions enforced server-side).
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { GraduationCap, UserPlus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
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
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';

export interface ResolvedModel {
  model: 'class' | 'course';
  source: 'profile' | 'schoolType';
}
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

interface ResolvedSubject {
  subjectOfferingId: string;
  subjectLabel: string;
  source: 'core' | 'elective' | 'registered';
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

export function EnrollmentManager({
  canManage,
  model,
  sections,
  years,
  students,
}: {
  canManage: boolean;
  model: ResolvedModel;
  sections: SectionOption[];
  years: YearOption[];
  students: StudentOption[];
}) {
  const router = useRouter();
  const [enrolOpen, setEnrolOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Enroll form
  const [studentId, setStudentId] = React.useState('');
  const [sectionId, setSectionId] = React.useState('');
  const [yearId, setYearId] = React.useState('');

  // Resolver
  const [resolveStudentId, setResolveStudentId] = React.useState('');
  const [subjects, setSubjects] = React.useState<ResolvedSubject[] | null>(
    null,
  );
  const [resolveError, setResolveError] = React.useState<string | null>(null);

  const canEnroll = canManage && studentId && sectionId && yearId && !busy;

  async function enroll() {
    setBusy(true);
    try {
      const res = await fetch('/api/academics/enrollment/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          classSectionId: sectionId,
          academicYearId: yearId,
        }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not enroll'));
        return;
      }
      toast.success('Student enrolled');
      setStudentId('');
      router.refresh();
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function viewSubjects() {
    if (!resolveStudentId) return;
    setBusy(true);
    setResolveError(null);
    try {
      const res = await fetch(
        `/api/academics/enrollment/students/${resolveStudentId}/subjects`,
      );
      if (!res.ok) {
        setSubjects(null);
        setResolveError(await errorMessage(res, 'Could not resolve subjects'));
        return;
      }
      const data = (await res.json()) as { subjects?: ResolvedSubject[] };
      setSubjects(data.subjects ?? []);
    } catch {
      setResolveError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  const sourceTone = (source: ResolvedSubject['source']) =>
    source === 'elective'
      ? 'info'
      : source === 'registered'
        ? 'success'
        : 'neutral';

  return (
    <div className="flex flex-col gap-6">
      {canManage && model.model === 'class' && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEnrolOpen(true)}>
            <UserPlus aria-hidden /> Enrol student
          </Button>
        </div>
      )}

      {/* Active model */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-4" aria-hidden /> Enrollment model
          </CardTitle>
          <CardDescription>
            How students join what they study for this school.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge tone={model.model === 'course' ? 'success' : 'info'}>
              {model.model === 'class'
                ? 'Class enrollment (K-12)'
                : 'Per-course registration (tertiary)'}
            </StatusBadge>
            <span className="text-muted-foreground">
              {model.source === 'profile'
                ? 'from the academic profile'
                : 'derived from the school type'}
            </span>
          </div>
        </CardContent>
      </Card>

      {canManage && model.model === 'class' && (
        <Dialog open={enrolOpen} onOpenChange={setEnrolOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Enrol into a section</DialogTitle>
              <DialogDescription>
                The student takes the section&apos;s subject offerings as a set.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {students.length === 0 ||
              sections.length === 0 ||
              years.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Need at least one student, one class section and one academic
                  year before you can enroll.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="en-student">Student</Label>
                    <Select value={studentId} onValueChange={setStudentId}>
                      <SelectTrigger id="en-student">
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
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="en-section">Section</Label>
                    <Select value={sectionId} onValueChange={setSectionId}>
                      <SelectTrigger id="en-section">
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
                    <Label htmlFor="en-year">Academic year</Label>
                    <Select value={yearId} onValueChange={setYearId}>
                      <SelectTrigger id="en-year">
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
                  <div className="sm:col-span-3">
                    <Button onClick={enroll} disabled={!canEnroll}>
                      Enroll student
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {canManage && model.model === 'course' && (
        <Card>
          <CardHeader>
            <CardTitle>Per-course registration</CardTitle>
            <CardDescription>
              This school registers students per subject offering. Use the
              enrollment API (<code>POST /academics/enrollment/courses</code>)
              or the offering surface to register.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Resolve a student's subjects */}
      <Card>
        <CardHeader>
          <CardTitle>Student subjects</CardTitle>
          <CardDescription>
            Resolve what a student studies — through offerings, by profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students to resolve.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rs-student">Student</Label>
                <Select
                  value={resolveStudentId}
                  onValueChange={setResolveStudentId}
                >
                  <SelectTrigger id="rs-student" className="min-w-56">
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
              <Button
                variant="outline"
                onClick={viewSubjects}
                disabled={!resolveStudentId || busy}
              >
                View subjects
              </Button>
            </div>
          )}

          {resolveError && (
            <p className="text-sm text-destructive" role="alert">
              {resolveError}
            </p>
          )}

          {subjects !== null &&
            (subjects.length === 0 ? (
              <EmptyState
                title="No subjects yet"
                description="This student isn't enrolled or registered for any offering."
              />
            ) : (
              <ul className="flex flex-col divide-y rounded-md border">
                {subjects.map((s) => (
                  <li
                    key={s.subjectOfferingId}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="font-medium">{s.subjectLabel}</span>
                    <StatusBadge tone={sourceTone(s.source)}>
                      {s.source}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
