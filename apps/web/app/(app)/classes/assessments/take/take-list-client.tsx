'use client';

import * as React from 'react';
import { ArrowRight, ClipboardList, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  ASSESSMENT_STATUS_META,
  classLabel,
  formatDate,
  type AssessmentSummary,
} from '@/lib/academics';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

export function AssessmentTakeListClient({
  initialAssessments,
}: {
  live?: boolean;
  initialAssessments: AssessmentSummary[];
}) {
  const router = useRouter();
  const [assessmentId, setAssessmentId] = React.useState('');
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialAssessments.filter((assessment) => {
      return (
        !needle ||
        assessment.name.toLowerCase().includes(needle) ||
        classLabel(assessment.class).toLowerCase().includes(needle)
      );
    });
  }, [initialAssessments, query]);

  function openAssessment(id: string) {
    if (!id.trim()) return;
    router.push(`/classes/assessments/take/${encodeURIComponent(id.trim())}`);
  }

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Take assessment"
          meta={[
            { key: 'available', label: `${initialAssessments.length} listed`, emphasis: true },
          ]}
        />

        <section className="grid gap-3 rounded-lg border bg-card p-4 @3xl/main:grid-cols-[1fr_auto] @3xl/main:items-end">
          <div className="grid gap-2">
            <Label htmlFor="assessment-id">Assessment ID</Label>
            <Input
              id="assessment-id"
              value={assessmentId}
              onChange={(event) => setAssessmentId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') openAssessment(assessmentId);
              }}
              placeholder="Paste assessment ID"
            />
          </div>
          <Button onClick={() => openAssessment(assessmentId)}>
            <ArrowRight /> Open
          </Button>
        </section>

        <DataTableLayout
          title="Published assessments"
          description={`${filtered.length} visible assessments`}
          empty={filtered.length === 0}
          toolbar={
            <div className="relative flex-1 min-w-0 @md/main:w-64 @md/main:flex-none">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Label htmlFor="assessment-take-search" className="sr-only">
                Search assessments
              </Label>
              <Input
                id="assessment-take-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search assessments"
                className="pl-8"
              />
            </div>
          }
          emptyState={
            <EmptyState
              compact
              icon={<ClipboardList aria-hidden />}
              title="No assessments listed"
              description="Use an assessment link or ID from your teacher."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sr-only">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((assessment) => {
                const status =
                  ASSESSMENT_STATUS_META[assessment.status] ??
                  ({ label: 'Published', tone: 'success' } as const);
                return (
                  <TableRow key={assessment.id}>
                    <TableCell className="font-medium">
                      {assessment.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {classLabel(assessment.class)}
                    </TableCell>
                    <TableCell>{formatDate(assessment.dueDate)}</TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openAssessment(assessment.id)}
                      >
                        Open <ArrowRight />
                      </Button>
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
