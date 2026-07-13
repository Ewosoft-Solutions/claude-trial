'use client';

/* ============================================================
   OnboardingChecklist — guided first-run for a new school (G11)

   Driven by real tenant stats: each step flips to done as the owner
   actually completes it. The whole card disappears once every step is
   done, so an established school never sees it.
   ============================================================ */

import Link from 'next/link';
import { CheckCircle2, Circle, Rocket } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import type { OverviewStats } from './use-overview-stats';

interface Step {
  key: string;
  label: string;
  hint: string;
  href: string;
  done: boolean;
}

export function OnboardingChecklist({ stats }: { stats: OverviewStats }) {
  const s = stats.school;
  const steps: Step[] = [
    {
      key: 'staff',
      label: 'Invite your team',
      hint: 'Add administrators, teachers and staff',
      href: '/settings/users',
      // > 1 because the owner themselves is already a staff account.
      done: s.staff > 1 || s.pendingInvitations > 0,
    },
    {
      key: 'students',
      label: 'Add your first students',
      hint: 'Enrol students or import a roster',
      href: '/students/enrollment',
      done: s.students > 0,
    },
    {
      key: 'classes',
      label: 'Create classes',
      hint: 'Set up classes and the timetable',
      href: '/classes/subjects',
      done: s.classes > 0,
    },
    {
      key: 'announce',
      label: 'Announce to your school',
      hint: 'Send your first announcement',
      href: '/events/upcoming',
      done: s.announcements > 0,
    },
  ];

  const completed = steps.filter((st) => st.done).length;
  if (completed === steps.length) return null;

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="size-4 text-primary" aria-hidden />
          Get your school set up
        </CardTitle>
        <CardDescription>
          {completed} of {steps.length} steps complete
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {steps.map((st) => (
          <Link
            key={st.key}
            href={st.href}
            className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-border bg-card p-3 outline-none transition-colors hover:border-ring/60 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {st.done ? (
              <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
            ) : (
              <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="flex min-w-0 flex-col">
              <span
                className={
                  st.done
                    ? 'text-sm font-medium text-muted-foreground line-through'
                    : 'text-sm font-semibold text-foreground'
                }
              >
                {st.label}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {st.hint}
              </span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
