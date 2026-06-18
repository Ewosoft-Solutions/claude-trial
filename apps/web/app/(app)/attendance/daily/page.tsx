'use client';

/* ============================================================
   /attendance/daily — the daily attendance register

   Class-by-class daily attendance (requirements: Attendance
   Management → Daily Attendance / Tardiness Tracking). Built from
   the M6 DataTableLayout (class + date toolbar, table, footer) with
   a per-row present / absent / late control mapped onto the shared
   ToggleGroup primitive. A live StatusBadge summary tracks the
   counts; "Mark all present" seeds the register. SkeletonTable
   shows on the brief mount-time load. Mock roster + copy live here.
   Replaces the `[...slug]` placeholder for this route.
   ============================================================ */

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

/* ---- mock data ----------------------------------------------- */

type Mark = 'present' | 'absent' | 'late';

interface Pupil {
  id: string;
  name: string;
}

const CLASSES = ['JSS 1A', 'JSS 2B', 'JSS 3A', 'SSS 1A'];

const ROSTER: Pupil[] = [
  { id: 'SJ-1042', name: 'Adaeze Okafor' },
  { id: 'SJ-1043', name: 'Tunde Bakare' },
  { id: 'SJ-1071', name: 'Chiamaka Eze' },
  { id: 'SJ-1088', name: 'Ibrahim Sani' },
  { id: 'SJ-1102', name: 'Fatima Bello' },
  { id: 'SJ-1119', name: 'Emeka Nwosu' },
  { id: 'SJ-1203', name: 'Zainab Yusuf' },
  { id: 'SJ-1221', name: 'David Adeyemi' },
  { id: 'SJ-1244', name: 'Grace Obi' },
  { id: 'SJ-1290', name: 'Samuel Etim' },
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

/** Seed every pupil as present. */
function allPresent(): Record<string, Mark> {
  return Object.fromEntries(ROSTER.map((p) => [p.id, 'present'])) as Record<
    string,
    Mark
  >;
}

export default function DailyRegisterPage() {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [classroom, setClassroom] = React.useState(CLASSES[0]);
  const [date, setDate] = React.useState('2025-03-24');
  const [marks, setMarks] = React.useState<Record<string, Mark>>(allPresent);

  const summary = React.useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    for (const p of ROSTER) {
      const m = marks[p.id];
      if (m === 'absent') absent++;
      else if (m === 'late') late++;
      else present++;
    }
    return { present, absent, late };
  }, [marks]);

  function setMark(id: string, value: Mark) {
    setMarks((prev) => ({ ...prev, [id]: value }));
  }

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
                onClick={() => setMarks(allPresent())}
              >
                <CircleCheck /> Mark all present
              </Button>
              <Button size="sm">
                <Check /> Save register
              </Button>
            </>
          }
        />

        <DataTableLayout
          title={`${classroom} register`}
          description={
            loading ? (
              'Loading roster…'
            ) : (
              <span className="flex flex-wrap items-center gap-1.5">
                <StatusBadge tone="success" dot>
                  {summary.present} present
                </StatusBadge>
                <StatusBadge tone="destructive" dot>
                  {summary.absent} absent
                </StatusBadge>
                <StatusBadge tone="warning" dot>
                  {summary.late} late
                </StatusBadge>
              </span>
            )
          }
          loading={loading}
          skeletonColumns={3}
          skeletonRows={ROSTER.length}
          toolbar={
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="register-class" className="sr-only">
                  Class
                </Label>
                <Select value={classroom} onValueChange={setClassroom}>
                  <SelectTrigger id="register-class" className="w-[7.5rem]">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="register-date" className="sr-only">
                  Date
                </Label>
                <Input
                  id="register-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-[10rem]"
                />
              </div>
            </>
          }
          footer={
            <span>
              <strong className="text-foreground">{ROSTER.length}</strong> pupils ·
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
              {ROSTER.map((p) => {
                const mark = marks[p.id] ?? 'present';
                const tone: Record<Mark, 'success' | 'destructive' | 'warning'> =
                  {
                    present: 'success',
                    absent: 'destructive',
                    late: 'warning',
                  };
                const label: Record<Mark, string> = {
                  present: 'Present',
                  absent: 'Absent',
                  late: 'Late',
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
                          <span className="truncate font-medium text-foreground">
                            {p.name}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {p.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-sm:hidden">
                      <StatusBadge tone={tone[mark]} dot>
                        {label[mark]}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        size="sm"
                        value={mark}
                        onValueChange={(v) => {
                          if (v) setMark(p.id, v as Mark);
                        }}
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
