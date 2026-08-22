'use client';

/**
 * Student placement — one page for every answer to "where does this student sit,
 * and how did they get there?".
 *
 * Merged from the former Class enrolment + Student lifecycle pages. They wrote
 * the same fact from two screens: enrolment created the `SectionEnrollment` row
 * directly, while the WB2-3 lifecycle service is the *authoritative* writer of
 * placement (it keeps the enrollment, the effective-dated history span and
 * `Student.enrollmentStatus` in lock-step). Two doors onto one fact is exactly
 * the ambiguity this consolidation removes.
 *
 * Promotion stays a separate page on purpose: it is a bulk, maker-checker
 * approved year rollover, not a per-student placement change.
 */
import * as React from 'react';
import {
  FolderTabs as Tabs,
  FolderTabsContent as TabsContent,
  FolderTabsList as TabsList,
  FolderTabsTrigger as TabsTrigger,
} from '@workspace/ui/custom/detail/folder-tabs';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

import {
  LifecycleManager,
  type SectionOption,
  type StudentOption,
  type YearOption,
} from './lifecycle-manager';
import {
  EnrollmentManager,
  type ResolvedModel,
} from '../enrollment/enrollment-manager';

export function PlacementWorkspace({
  canManageLifecycle,
  canManageEnrollment,
  model,
  sections,
  years,
  students,
}: {
  canManageLifecycle: boolean;
  canManageEnrollment: boolean;
  model: ResolvedModel;
  sections: SectionOption[];
  years: YearOption[];
  students: StudentOption[];
}) {
  return (
    <ShellMain>
      <PageHeader
        title="Student placement"
        description="Where each student sits and how they got there — enrol them into a section, then transfer, withdraw or graduate. Every change is a durable, dated event, so a placement is never overwritten."
      />

      <Tabs defaultValue="lifecycle">
        <TabsList className="mb-4">
          <TabsTrigger value="lifecycle">Placement &amp; history</TabsTrigger>
          <TabsTrigger value="enrolment">Enrolment &amp; subjects</TabsTrigger>
        </TabsList>

        <TabsContent value="lifecycle">
          <LifecycleManager
            canManage={canManageLifecycle}
            sections={sections}
            years={years}
            students={students}
          />
        </TabsContent>

        <TabsContent value="enrolment">
          <EnrollmentManager
            canManage={canManageEnrollment}
            model={model}
            sections={sections}
            years={years}
            students={students}
          />
        </TabsContent>
      </Tabs>
    </ShellMain>
  );
}
