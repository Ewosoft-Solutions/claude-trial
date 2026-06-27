'use client';

/* ================================================================
   DailyRegisterClient — interactive attendance register

   Receives initial classes + students from the server component.
   All state (class/date selection, per-student marks) lives here.
   Saves via POST /api/attendance (Route Handler → NestJS).
   Falls back to hardcoded mock data when no API is configured.
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

interface Props {
  classes: ClassOption[];
  initialClassId: string;
  initialStudents: Pupil[];
  initialRecords: AttendanceRecord[];
}

/* ---- fallback mock data (used when classes/students are empty) ----------- */
const MOCK_CLASSES: ClassOption[] = [
  { id: 'JSS1A', label: 'JSS 1A' },
  { id: 'JSS2B', label: 'JSS 2B' },
  { id: 'JSS3A', label: 'JSS 3A' },
  { id: 'SSS1A', label: 'SSS 1A' },
];

const MOCK_STUDENTS: Pupil[] = [
  { id: 'SJ-1042', studentNumber: 'SJ-1042', name: 'Adaeze Okafor' },
  { id: 'SJ-1043', studentNumber: 'SJ-1043', name: 'Tunde Bakare' },
  { id: 'SJ-1071', studentNumber: 'SJ-1071', name: 'Chiamaka Eze' },
  { id: 'SJ-1088', studentNumber: 'SJ-1088', name: 'Ibrahim Sani' },
  { id: 'SJ-1102', studentNumber: 'SJ-1102', name: 'Fatima Bello' },
  { id: 'SJ-1119', studentNumber: 'SJ-1119', name: 'Emeka Nwosu' },
  { id: 'SJ-1203', studentNumber: 'SJ-1203', name: 'Zainab Yusuf' },
  { id: 'SJ-1221', studentNumber: 'SJ-1221', name: 'David Adeyemi' },
  { id: 'SJ-1244', studentNumber: 'SJ-1244', name: 'Grace Obi' },
  { id: 'SJ-1290', studentNumber: 'SJ-1290', name: 'Samuel Etim' },
];

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

export function DailyRegisterClient({
  classes: propClasses,
  initialClassId,
  initialStudents,
  initialRecords,
}: Props) {
  const classes = propClasses.length ? propClasses : MOCK_CLASSES;
  const [classId, setClassId] = React.useState(initialClassId || classes[0]?.id || '');
  const [date, setDate] = React.useState(todayISO);

  const [students, setStudents] = React.useState<Pupil[]>(
    initialStudents.length ? initialStudents : MOCK_STUDENTS,
  );
  const [marks, setMarks] = React.useState<Record<string, Mark>>(() =>
    seedMarks(initialStudents.length ? initialStudents : MOCK_STUDENTS, initialRecords),
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
        const data = (await res.json()) as AttendanceRecord[] | { records: AttendanceRecord[] };
        const records = Array.isArray(data) ? data : (data as { records: AttendanceRecord[] }).records ?? [];
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
          const data = (await res.json()) as { students?: Pupil[]; data?: Pupil[] } | Pupil[];
          const list: Pupil[] = Array.isArray(data) ? data : ((data as { students?: Pupil[] }).students ?? []);
          if (list.length) {
            setStudents(list);
            await fetchAttendance(cId, d, list);
            return;
          }
        }
        // Fallback: keep current students, just refresh attendance
        await fetchAttendance(cId, d, students);
      } finally {
        setLoading(false);
      }
    },
    [fetchAttendance, students],
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
              <Button variant="outline" size="sm" onClick={markAllPresent}>
                <CircleCheck /> Mark all present
              </Button>
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={saving}
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
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pupil</TableHead>
                <TableHead className="max-sm:hidden">Status</TableHead>
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
                          <span className="truncate font-medium text-foreground">{p.name}</span>
                          <span className="truncate text-xs text-muted-foreground">{p.studentNumber}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-sm:hidden">
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
