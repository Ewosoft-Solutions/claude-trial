'use client';

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
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

export interface TimetableSlot {
  day?: string;
  startTime?: string;
  endTime?: string;
  room?: string;
}

export interface TimetableClass {
  id: string;
  label: string;
  subject: string;
  term?: string;
  room?: string;
  schedule: TimetableSlot[];
}

interface Props {
  classes: TimetableClass[];
}

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TONES: ScheduleTone[] = ['accent', 'info', 'success', 'warning', 'default'];
const BADGE_TONE: Record<ScheduleTone, Parameters<typeof StatusBadge>[0]['tone']> = {
  default: 'neutral',
  info: 'info',
  success: 'success',
  warning: 'warning',
  accent: 'info',
};

function toneFor(value: string): ScheduleTone {
  const total = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TONES[total % TONES.length] ?? 'default';
}

function periodKey(slot: TimetableSlot): string {
  return `${slot.startTime ?? ''}-${slot.endTime ?? ''}`;
}

function periodLabel(slot: TimetableSlot, index: number): SchedulePeriod {
  const start = slot.startTime ?? 'Time';
  const end = slot.endTime ? `-${slot.endTime}` : '';
  return { key: periodKey(slot), label: `Period ${index + 1}`, time: `${start}${end}` };
}

function buildPeriods(schedule: TimetableSlot[]): SchedulePeriod[] {
  const unique = new Map<string, TimetableSlot>();
  for (const slot of schedule) {
    if (slot.startTime) unique.set(periodKey(slot), slot);
  }
  return Array.from(unique.values())
    .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))
    .map(periodLabel);
}

function buildDays(schedule: TimetableSlot[]): string[] {
  const days = new Set(schedule.map((slot) => slot.day).filter(Boolean) as string[]);
  return DAY_ORDER.filter((day) => days.has(day));
}

function buildEntries(cls: TimetableClass): ScheduleEntry[] {
  const tone = toneFor(cls.subject);
  return cls.schedule.map((slot, index) => ({
    key: `${cls.id}-${index}`,
    day: slot.day ?? '',
    period: periodKey(slot),
    title: cls.subject,
    subtitle: slot.room ?? cls.room ?? cls.label,
    tone,
  }));
}

export function TimetableClient({ classes }: Props) {
  const scheduledClasses = React.useMemo(
    () => classes.filter((cls) => cls.schedule.length > 0),
    [classes],
  );
  const [classId, setClassId] = React.useState(scheduledClasses[0]?.id ?? '');
  const selected = scheduledClasses.find((cls) => cls.id === classId) ?? scheduledClasses[0];
  const periods = selected ? buildPeriods(selected.schedule) : [];
  const days = selected ? buildDays(selected.schedule) : [];
  const entries = selected ? buildEntries(selected) : [];
  const meta: PageHeaderMeta[] = [
    { key: 'source', label: 'live class schedules', emphasis: true },
    { key: 'classes', label: `${scheduledClasses.length} scheduled classes` },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Timetable"
          meta={meta}
          actions={
            <Button variant="outline" size="sm">
              <Printer /> Print
            </Button>
          }
        />

        {scheduledClasses.length === 0 ? (
          <EmptyState
            title="No class schedules yet"
            description="Add schedule entries to classes and they will appear here."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Label htmlFor="timetable-class" className="text-sm font-medium">
                Class
              </Label>
              <Select value={selected?.id} onValueChange={setClassId}>
                <SelectTrigger id="timetable-class" className="w-[13rem]">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  {scheduledClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selected ? (
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <StatusBadge tone={BADGE_TONE[toneFor(selected.subject)]} dot>
                    {selected.subject}
                  </StatusBadge>
                  {selected.term ? <StatusBadge tone="neutral">{selected.term}</StatusBadge> : null}
                </div>
              ) : null}
            </div>

            <ScheduleGrid days={days} periods={periods} entries={entries} />
          </>
        )}
      </div>
    </ShellMain>
  );
}
