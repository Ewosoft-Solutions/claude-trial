'use client';

/* ================================================================
   DailyRegisterClient — interactive attendance register

   Receives initial classes + students from the server component.
   All state (class/date selection, per-student marks) lives here.
   Saves via POST /api/attendance (Route Handler → NestJS).
   ================================================================ */

import * as React from 'react';
import { Check, CircleCheck, Clock, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@workspace/ui/components/toggle-group';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

export type Mark = 'present' | 'absent' | 'late' | 'excused';

export interface ClassOption {
  id: string;
  label: string;
}

export interface Pupil {
  id: string;        // student DB id
  studentNumber: string;
  name: string;
}

export interface AttendanceRecord {
  studentId: string;
  status: Mark;
}

interface ApiStudent {
  id: string;
  studentNumber: string;
  userTenant?: { user?: { firstName?: string | null; lastName?: string | null } | null };
}

interface Props {
  classes: ClassOption[];
  initialClassId: string;
  initialStudents: Pupil[];
  initialRecords: AttendanceRecord[];
}

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'week', label: 'Week 6 of 13' },
];

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function seedMarks(pupils: Pupil[], existing: AttendanceRecord[]): Record<string, Mark> {
  const base = Object.fromEntries(pupils.map((p) => [p.id, 'present' as Mark]));
  for (const r of existing) {
    if (r.studentId in base) base[r.studentId] = r.status;
  }
  return base;
}

function studentName(student: ApiStudent): string {
  const user = student.userTenant?.user;
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || student.studentNumber;
}

function toPupil(student: ApiStudent): Pupil {
  return {
    id: student.id,
    studentNumber: student.studentNumber,
    name: studentName(student),
  };
}

export function DailyRegisterClient({
  classes: propClasses,
  initialClassId,
  initialStudents,
  initialRecords,
}: Props) {
  const classes = propClasses;
  const [classId, setClassId] = React.useState(initialClassId || classes[0]?.id || '');
  const [date, setDate] = React.useState(todayISO);

  const [students, setStudents] = React.useState<Pupil[]>(initialStudents);
  const [marks, setMarks] = React.useState<Record<string, Mark>>(() =>
    seedMarks(initialStudents, initialRecords),
  );

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saved' | 'error'>('idle');

  /** Re-fetch attendance when class or date changes. */
  const fetchAttendance = React.useCallback(
    async (cId: string, d: string, sList: Pupil[]) => {
      if (!cId) return;
      setLoading(true);
      try {
        const qs = new URLSearchParams({ classId: cId, date: d }).toString();
        const res = await fetch(`/api/attendance?${qs}`);
        if (!res.ok) return;
        const data = (await res.json()) as
          | AttendanceRecord[]
          | { records?: AttendanceRecord[] }
          | null;
        const records = Array.isArray(data)
          ? data
          : ((data as { records?: AttendanceRecord[] } | null)?.records ?? []);
        setMarks(seedMarks(sList, records));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /** Fetch students for the selected class. */
  const fetchStudents = React.useCallback(
    async (cId: string, d: string) => {
      if (!cId) return;
      setLoading(true);
      try {
        // Try fetching enrolled students for this class
        const qs = new URLSearchParams({ classId: cId }).toString();
        const res = await fetch(`/api/students?${qs}`);
        if (res.ok) {
          const data = (await res.json()) as
            | { students?: ApiStudent[]; data?: ApiStudent[] }
            | ApiStudent[]
            | null;
          const raw = Array.isArray(data)
            ? data
            : ((data as { students?: ApiStudent[] } | null)?.students ??
              (data as { data?: ApiStudent[] } | null)?.data ??
              []);
          const list = raw.map(toPupil);
          if (list.length) {
            setStudents(list);
            await fetchAttendance(cId, d, list);
            return;
          }
        }
        setStudents([]);
        setMarks({});
      } finally {
        setLoading(false);
      }
    },
    [fetchAttendance],
  );

  function handleClassChange(newId: string) {
    setClassId(newId);
    setSaveStatus('idle');
    void fetchStudents(newId, date);
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const d = e.target.value;
    setDate(d);
    setSaveStatus('idle');
    void fetchAttendance(classId, d, students);
  }

  function setMark(id: string, value: Mark) {
    setMarks((prev) => ({ ...prev, [id]: value }));
    setSaveStatus('idle');
  }

  function markAllPresent() {
    setMarks(Object.fromEntries(students.map((p) => [p.id, 'present' as Mark])));
    setSaveStatus('idle');
  }

  async function save() {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const records = students.map((p) => ({
        studentId: p.id,
        status: marks[p.id] ?? 'present',
      }));
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, date, records }),
      });
      setSaveStatus(res.ok ? 'saved' : 'error');
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }

  const summary = React.useMemo(() => {
    let present = 0, absent = 0, late = 0, excused = 0;
    for (const p of students) {
      const m = marks[p.id] ?? 'present';
      if (m === 'absent') absent++;
      else if (m === 'late') late++;
      else if (m === 'excused') excused++;
      else present++;
    }
    return { present, absent, late, excused };
  }, [marks, students]);

  const selectedLabel = classes.find((c) => c.id === classId)?.label ?? classId;

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Daily register"
          meta={META}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={markAllPresent}
                disabled={students.length === 0}
              >
                <CircleCheck /> Mark all present
              </Button>
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={saving || !classId || students.length === 0}
              >
                <Check />
                {saving ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : 'Save register'}
              </Button>
            </>
          }
        />

        <DataTableLayout
          title={`${selectedLabel} register`}
          description={
            loading ? (
              'Loading roster…'
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                <StatusBadge tone="success" dot>{summary.present} present</StatusBadge>
                <StatusBadge tone="destructive" dot>{summary.absent} absent</StatusBadge>
                <StatusBadge tone="warning" dot>{summary.late} late</StatusBadge>
                {summary.excused > 0 && (
                  <StatusBadge tone="neutral" dot>{summary.excused} excused</StatusBadge>
                )}
                {saveStatus === 'error' && (
                  <StatusBadge tone="destructive">Save failed</StatusBadge>
                )}
              </span>
            )
          }
          loading={loading}
          empty={!loading && students.length === 0}
          skeletonColumns={3}
          skeletonRows={students.length || 10}
          toolbar={
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="register-class" className="sr-only">Class</Label>
                <Select value={classId} onValueChange={handleClassChange}>
                  <SelectTrigger id="register-class" className="w-[7.5rem]">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="register-date" className="sr-only">Date</Label>
                <Input
                  id="register-date"
                  type="date"
                  value={date}
                  onChange={handleDateChange}
                  className="w-[10rem]"
                />
              </div>
            </>
          }
          footer={
            <span>
              <strong className="text-foreground">{students.length}</strong> pupils ·
              register for {date}
            </span>
          }
          emptyState={
            <EmptyState
              compact
              title={classes.length === 0 ? 'No classes available' : 'No pupils enrolled'}
              description={
                classes.length === 0
                  ? 'Run the dev academic seed or create an active class.'
                  : 'Enroll students in this class before taking attendance.'
              }
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pupil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((p) => {
                const mark = marks[p.id] ?? 'present';
                const tone: Record<Mark, 'success' | 'destructive' | 'warning' | 'neutral'> = {
                  present: 'success',
                  absent: 'destructive',
                  late: 'warning',
                  excused: 'neutral',
                };
                const label: Record<Mark, string> = {
                  present: 'Present',
                  absent: 'Absent',
                  late: 'Late',
                  excused: 'Excused',
                };
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="break-words font-medium text-foreground">{p.name}</span>
                          <span className="break-words text-xs text-muted-foreground">{p.studentNumber}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={tone[mark]} dot>{label[mark]}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={mark}
                        onValueChange={(v) => { if (v) setMark(p.id, v as Mark); }}
                        className="justify-end"
                        aria-label={`Attendance for ${p.name}`}
                      >
                        <ToggleGroupItem
                          value="present"
                          aria-label="Present"
                          className="data-[state=on]:bg-success/15 data-[state=on]:text-success"
                        >
                          <Check /> <span className="max-lg:sr-only">Present</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="late"
                          aria-label="Late"
                          className="data-[state=on]:bg-warning/15 data-[state=on]:text-warning"
                        >
                          <Clock /> <span className="max-lg:sr-only">Late</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="absent"
                          aria-label="Absent"
                          className="data-[state=on]:bg-destructive/15 data-[state=on]:text-destructive"
                        >
                          <X /> <span className="max-lg:sr-only">Absent</span>
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataTableLayout>
      </div>
    </ShellMain>
  );
}
