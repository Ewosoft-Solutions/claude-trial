'use client';

import Link from 'next/link';
import * as React from 'react';
import { Download, GraduationCap, Plus, Users } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { ModeToggle } from '@workspace/ui/custom/mode-toggle';
import { WorkbenchLayout } from '@workspace/ui/custom/workbench/workbench-layout';
import { LifecycleBar } from '@workspace/ui/custom/lifecycle/lifecycle-bar';
import { PolicyVersionPanel } from '@workspace/ui/custom/policy/policy-version-panel';
import { ApprovalPanel } from '@workspace/ui/custom/approval/approval-panel';
import { Dot } from '@workspace/ui/custom/data-display/dot';
import type {
  LifecycleStep,
  PolicyVersion,
} from '@workspace/ui/types/patterns.types';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A workbench inherits a persistent context bar (year/term/campus). */
function ContextBar() {
  return (
    <>
      <Select defaultValue="2025">
        <SelectTrigger className="h-7 w-[8.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="2025">2025 / 2026</SelectItem>
          <SelectItem value="2024">2024 / 2025</SelectItem>
        </SelectContent>
      </Select>
      <Select defaultValue="t1">
        <SelectTrigger className="h-7 w-[7rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="t1">Term 1</SelectItem>
          <SelectItem value="t2">Term 2</SelectItem>
        </SelectContent>
      </Select>
      <Select defaultValue="main">
        <SelectTrigger className="h-7 w-[8rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="main">Main campus</SelectItem>
          <SelectItem value="annex">Annex</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

function TabPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-border bg-secondary/30 p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

const RESULT_LIFECYCLE: LifecycleStep[] = [
  { key: 'draft', label: 'Draft', state: 'done' },
  { key: 'published', label: 'Published', state: 'done' },
  { key: 'locked', label: 'Locked', state: 'current' },
  { key: 'amended', label: 'Amended', state: 'upcoming', tone: 'warning' },
];

const ADMISSION_LIFECYCLE: LifecycleStep[] = [
  { key: 'applied', label: 'Applied', state: 'done' },
  { key: 'offered', label: 'Offered', state: 'current' },
  { key: 'accepted', label: 'Accepted', state: 'upcoming' },
  { key: 'enrolled', label: 'Enrolled', state: 'upcoming' },
];

const VERSIONS: PolicyVersion[] = [
  {
    id: 'v2025',
    label: 'NERDC 2025',
    status: 'Draft',
    tone: 'info',
    effectiveFrom: '2025-09-01',
    meta: 'by Ada',
  },
  {
    id: 'v2020',
    label: 'NERDC 2020',
    isActive: true,
    effectiveFrom: '2020-09-01',
    meta: 'in force',
  },
];

export default function PatternsPage() {
  const [peopleTab, setPeopleTab] = React.useState('overview');
  const [acadTab, setAcadTab] = React.useState('subjects');
  const [selectedVersion, setSelectedVersion] = React.useState('v2025');
  const [comparing, setComparing] = React.useState(false);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Workspace patterns (F8)
          </h1>
          <p className="text-sm text-muted-foreground">
            The shared Aurora shells every workbench reuses. Toggle the theme to
            verify light / dark / classic-dark parity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/design-system">← Design system</Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <Section
        title="Workbench"
        description="Two different workspaces render from the SAME shell — a persistent context bar plus a tab strip — differing only in content."
      >
        <div className="grid gap-8 @container">
          <WorkbenchLayout
            title="People"
            description="Students · Guardians · Staff"
            context={<ContextBar />}
            actions={
              <>
                <Button variant="outline" size="sm">
                  <Download className="size-4" /> Export
                </Button>
                <Button size="sm">
                  <Plus className="size-4" /> Add person
                </Button>
              </>
            }
            tabs={[
              { key: 'overview', label: 'Overview', icon: <Users /> },
              { key: 'students', label: 'Students', badge: 812 },
              { key: 'guardians', label: 'Guardians', badge: 640 },
              { key: 'staff', label: 'Staff', badge: 74 },
            ]}
            activeTab={peopleTab}
            onTabChange={setPeopleTab}
          >
            <TabPanel>
              People
              <Dot />“{peopleTab}” section content goes here.
            </TabPanel>
          </WorkbenchLayout>

          <WorkbenchLayout
            title="Academics"
            description="Curriculum · Offerings · Results"
            context={<ContextBar />}
            actions={
              <Button size="sm">
                <GraduationCap className="size-4" /> New version
              </Button>
            }
            tabs={[
              { key: 'subjects', label: 'Subjects', badge: 11 },
              { key: 'offerings', label: 'Offerings' },
              { key: 'coverage', label: 'Coverage' },
            ]}
            activeTab={acadTab}
            onTabChange={setAcadTab}
          >
            <TabPanel>
              Academics
              <Dot />“{acadTab}” section content goes here.
            </TabPanel>
          </WorkbenchLayout>
        </div>
      </Section>

      <Section
        title="Lifecycle"
        description="A record's status view — current state highlighted by tone AND a non-colour cue (ring + aria-current); completed states carry a check."
      >
        <div className="grid gap-8 rounded-[var(--radius-lg)] border border-border bg-card p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[calc(12.5px*var(--font-scale))] font-semibold text-muted-foreground">
              Result publication
            </p>
            <LifecycleBar steps={RESULT_LIFECYCLE} label="Result lifecycle" />
          </div>
          <div className="space-y-2">
            <p className="text-[calc(12.5px*var(--font-scale))] font-semibold text-muted-foreground">
              Admission
            </p>
            <LifecycleBar
              steps={ADMISSION_LIFECYCLE}
              label="Admission lifecycle"
            />
          </div>
        </div>
      </Section>

      <Section
        title="Policy (versioned config)"
        description="Clone / compare / activate for anything versioned rather than mutated — a curriculum version, a role policy, a fee schedule."
      >
        <PolicyVersionPanel
          versions={VERSIONS}
          selectedId={selectedVersion}
          onSelect={(id) => {
            setSelectedVersion(id);
            setComparing(false);
          }}
          onClone={() => undefined}
          onActivate={() => undefined}
          onCompare={() => setComparing(true)}
          compareRows={
            comparing
              ? [
                  {
                    key: 'subjects',
                    label: 'Subjects',
                    before: '9',
                    after: '11',
                    changed: true,
                  },
                  {
                    key: 'cca',
                    label: 'Creative arts',
                    before: 'Cultural And Creative Arts',
                    after: 'Cultural & Creative Arts',
                    changed: true,
                  },
                  {
                    key: 'maths',
                    label: 'Mathematics',
                    before: '✓',
                    after: '✓',
                  },
                ]
              : undefined
          }
          compareTitle={comparing ? 'NERDC 2020 → 2025' : undefined}
        />
      </Section>

      <Section
        title="Approval (maker-checker)"
        description="High-risk changes are requests, not silent mutations. Approve / reject, a separation-of-duties block, and a step-up notice are first-class."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          <ApprovalPanel
            request={{
              title: 'Grant bursar export for Campus B',
              requestedBy: 'Ada Okafor',
              requestedAt: '2 Aug, 10:12',
              reason: 'Month-end debtor reconciliation',
            }}
            fields={[
              {
                key: 'scope',
                label: 'Export scope',
                before: 'Campus A',
                after: 'Campus A + B',
              },
            ]}
            stepUpRequired
            onApprove={() => undefined}
            onReject={() => undefined}
          />
          <ApprovalPanel
            request={{
              title: 'Change your own clearance to 9',
              requestedBy: 'You',
              requestedAt: 'just now',
              riskLabel: 'Critical',
              riskTone: 'destructive',
            }}
            fields={[
              { key: 'clr', label: 'Clearance', before: '7', after: '9' },
            ]}
            isSelfRequest
          />
          <ApprovalPanel
            request={{
              title: 'Publish SS3 results',
              requestedBy: 'B. Adeyemi',
              requestedAt: 'Yesterday',
              riskLabel: 'Review',
              riskTone: 'info',
            }}
            fields={[
              {
                key: 'state',
                label: 'State',
                before: 'Locked',
                after: 'Published',
              },
            ]}
            canApprove={false}
          />
        </div>
      </Section>
    </main>
  );
}
