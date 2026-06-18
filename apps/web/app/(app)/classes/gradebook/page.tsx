'use client';

/* ============================================================
   /classes/gradebook — class gradebook

   A scores grid (students × assessments → total + grade) framed by
   the M6 DataTableLayout, with class + subject selectors and the M5
   SkeletonTable on load. The letter grade reads as a StatusBadge.
   Mock scores + copy live here. Replaces the `[...slug]` placeholder.
   ============================================================ */

import * as React from 'react';
import { Download } from 'lucide-react';

import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
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
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

interface Score {
  id: string;
  name: string;
  ca1: number; // out of 20
  ca2: number; // out of 20
  exam: number; // out of 60
}

const CLASSES = ['JSS 1A', 'JSS 2B', 'SSS 1A'];
const SUBJECTS = ['Mathematics', 'English', 'Basic Science'];

const SCORES: Score[] = [
  { id: 'SJ-1042', name: 'Adaeze Okafor', ca1: 18, ca2: 17, exam: 55 },
  { id: 'SJ-1043', name: 'Tunde Bakare', ca1: 12, ca2: 14, exam: 38 },
  { id: 'SJ-1071', name: 'Chiamaka Eze', ca1: 16, ca2: 15, exam: 48 },
  { id: 'SJ-1088', name: 'Ibrahim Sani', ca1: 9, ca2: 11, exam: 28 },
  { id: 'SJ-1102', name: 'Fatima Bello', ca1: 19, ca2: 18, exam: 58 },
  { id: 'SJ-1119', name: 'Emeka Nwosu', ca1: 14, ca2: 13, exam: 41 },
  { id: 'SJ-1203', name: 'Zainab Yusuf', ca1: 17, ca2: 16, exam: 52 },
  { id: 'SJ-1221', name: 'David Adeyemi', ca1: 7, ca2: 8, exam: 22 },
];

function grade(total: number): { letter: string; tone: StateTone } {
  if (total >= 70) return { letter: 'A', tone: 'success' };
  if (total >= 60) return { letter: 'B', tone: 'success' };
  if (total >= 50) return { letter: 'C', tone: 'info' };
  if (total >= 40) return { letter: 'D', tone: 'warning' };
  return { letter: 'F', tone: 'destructive' };
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'assess', label: 'CA1 · CA2 · Exam' },
];

export default function GradebookPage() {
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [classroom, setClassroom] = React.useState(CLASSES[0]);
  const [subject, setSubject] = React.useState(SUBJECTS[0]);

  const classAverage = React.useMemo(() => {
    const total = SCORES.reduce((sum, s) => sum + s.ca1 + s.ca2 + s.exam, 0);
    return Math.round(total / SCORES.length);
  }, []);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Gradebook"
          meta={META}
          actions={
            <Button variant="outline" size="sm">
              <Download /> Export results
            </Button>
          }
        />

        <DataTableLayout
          title={`${classroom} · ${subject}`}
          description={
            loading
              ? 'Loading scores…'
              : `${SCORES.length} students · class average ${classAverage}%`
          }
          loading={loading}
          skeletonColumns={6}
          skeletonRows={SCORES.length}
          toolbar={
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="gradebook-class" className="sr-only">
                  Class
                </Label>
                <Select value={classroom} onValueChange={setClassroom}>
                  <SelectTrigger id="gradebook-class" className="w-[7.5rem]">
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
                <Label htmlFor="gradebook-subject" className="sr-only">
                  Subject
                </Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger id="gradebook-subject" className="w-[9rem]">
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          }
          footer={
            <span>
              <strong className="text-foreground">{SCORES.length}</strong> students ·
              CA1/CA2 out of 20 · Exam out of 60
            </span>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="text-right">CA1</TableHead>
                <TableHead className="text-right">CA2</TableHead>
                <TableHead className="text-right">Exam</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SCORES.map((s) => {
                const total = s.ca1 + s.ca2 + s.exam;
                const g = grade(total);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials(s.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate font-medium text-foreground">
                            {s.name}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {s.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {s.ca1}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {s.ca2}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {s.exam}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground">
                      {total}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusBadge tone={g.tone}>{g.letter}</StatusBadge>
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
