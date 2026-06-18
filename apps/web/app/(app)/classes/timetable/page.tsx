'use client';

/* ============================================================
   /classes/timetable — weekly class timetable

   Built on the shared ScheduleGrid (a week × period grid) rather
   than a table — the first in-app use of that data-display pattern.
   A class Select swaps the week's entries; the legend explains the
   subject colour-coding. Mock schedule + copy live here; the grid
   stays data-driven. Replaces the `[...slug]` placeholder.
   ============================================================ */

import * as React from 'react';
import { Printer } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import {
  ScheduleGrid,
  type ScheduleEntry,
  type SchedulePeriod,
  type ScheduleTone,
} from '@workspace/ui/custom/data-display/schedule-grid';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const PERIODS: SchedulePeriod[] = [
  { key: 'p1', label: 'Period 1', time: '08:00' },
  { key: 'p2', label: 'Period 2', time: '08:50' },
  { key: 'p3', label: 'Break', time: '09:40' },
  { key: 'p4', label: 'Period 3', time: '10:00' },
  { key: 'p5', label: 'Period 4', time: '10:50' },
  { key: 'p6', label: 'Period 5', time: '11:40' },
];

const CLASSES = ['JSS 1A', 'JSS 2B', 'SSS 1A'];

// Subject → colour-coding, shared by the grid + legend.
const SUBJECT_TONE: Record<string, ScheduleTone> = {
  Mathematics: 'accent',
  English: 'info',
  'Basic Science': 'success',
  'Social Studies': 'warning',
  Break: 'default',
};

function entry(
  key: string,
  day: string,
  period: string,
  title: string,
  room: string,
): ScheduleEntry {
  return {
    key,
    day,
    period,
    title,
    subtitle: title === 'Break' ? undefined : room,
    tone: SUBJECT_TONE[title] ?? 'default',
  };
}

const TIMETABLE: Record<string, ScheduleEntry[]> = {
  'JSS 1A': [
    entry('1', 'Mon', 'p1', 'Mathematics', 'Rm 12'),
    entry('2', 'Mon', 'p2', 'English', 'Rm 12'),
    entry('3', 'Mon', 'p4', 'Basic Science', 'Lab 1'),
    entry('4', 'Mon', 'p5', 'Social Studies', 'Rm 12'),
    entry('5', 'Tue', 'p1', 'English', 'Rm 12'),
    entry('6', 'Tue', 'p2', 'Mathematics', 'Rm 12'),
    entry('7', 'Tue', 'p5', 'Basic Science', 'Lab 1'),
    entry('8', 'Wed', 'p1', 'Basic Science', 'Lab 1'),
    entry('9', 'Wed', 'p4', 'Mathematics', 'Rm 12'),
    entry('10', 'Wed', 'p6', 'Social Studies', 'Rm 12'),
    entry('11', 'Thu', 'p2', 'Social Studies', 'Rm 12'),
    entry('12', 'Thu', 'p4', 'English', 'Rm 12'),
    entry('13', 'Thu', 'p5', 'Mathematics', 'Rm 12'),
    entry('14', 'Fri', 'p1', 'Mathematics', 'Rm 12'),
    entry('15', 'Fri', 'p4', 'English', 'Rm 12'),
    entry('16', 'Fri', 'p6', 'Basic Science', 'Lab 1'),
  ],
  'JSS 2B': [
    entry('1', 'Mon', 'p1', 'English', 'Rm 21'),
    entry('2', 'Mon', 'p4', 'Mathematics', 'Rm 21'),
    entry('3', 'Tue', 'p2', 'Basic Science', 'Lab 2'),
    entry('4', 'Wed', 'p1', 'Social Studies', 'Rm 21'),
    entry('5', 'Wed', 'p5', 'Mathematics', 'Rm 21'),
    entry('6', 'Thu', 'p4', 'English', 'Rm 21'),
    entry('7', 'Fri', 'p2', 'Basic Science', 'Lab 2'),
    entry('8', 'Fri', 'p5', 'Social Studies', 'Rm 21'),
  ],
  'SSS 1A': [
    entry('1', 'Mon', 'p2', 'Mathematics', 'Rm 30'),
    entry('2', 'Tue', 'p1', 'English', 'Rm 30'),
    entry('3', 'Tue', 'p4', 'Basic Science', 'Lab 3'),
    entry('4', 'Wed', 'p2', 'Mathematics', 'Rm 30'),
    entry('5', 'Thu', 'p1', 'Social Studies', 'Rm 30'),
    entry('6', 'Thu', 'p5', 'English', 'Rm 30'),
    entry('7', 'Fri', 'p4', 'Mathematics', 'Rm 30'),
  ],
};

// Break sits in the same slot for every day of the week.
const BREAKS: ScheduleEntry[] = DAYS.map((day) => ({
  key: `break-${day}`,
  day,
  period: 'p3',
  title: 'Break',
  tone: 'default' as ScheduleTone,
}));

const LEGEND: { subject: string; tone: ScheduleTone }[] = [
  { subject: 'Mathematics', tone: 'accent' },
  { subject: 'English', tone: 'info' },
  { subject: 'Basic Science', tone: 'success' },
  { subject: 'Social Studies', tone: 'warning' },
];

const LEGEND_TONE: Record<ScheduleTone, Parameters<typeof StatusBadge>[0]['tone']> =
  {
    default: 'neutral',
    info: 'info',
    success: 'success',
    warning: 'warning',
    accent: 'info',
  };

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'week', label: 'Week 6 of 13' },
];

export default function TimetablePage() {
  const [classroom, setClassroom] = React.useState(CLASSES[0] ?? 'JSS 1A');

  const entries = React.useMemo(
    () => [...(TIMETABLE[classroom] ?? []), ...BREAKS],
    [classroom],
  );

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Timetable"
          meta={META}
          actions={
            <Button variant="outline" size="sm">
              <Printer /> Print
            </Button>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <Label htmlFor="timetable-class" className="text-sm font-medium">
            Class
          </Label>
          <Select value={classroom} onValueChange={setClassroom}>
            <SelectTrigger id="timetable-class" className="w-[8rem]">
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

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {LEGEND.map((l) => (
              <StatusBadge key={l.subject} tone={LEGEND_TONE[l.tone]} dot>
                {l.subject}
              </StatusBadge>
            ))}
          </div>
        </div>

        <ScheduleGrid days={DAYS} periods={PERIODS} entries={entries} />
      </div>
    </ShellMain>
  );
}
