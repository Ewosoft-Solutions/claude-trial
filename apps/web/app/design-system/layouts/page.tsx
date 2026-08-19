'use client';

import Link from 'next/link';
import * as React from 'react';
import {
  Bell,
  CreditCard,
  Plus,
  Shield,
  SlidersHorizontal,
  UserCog,
  Users,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@workspace/ui/components/tabs';
import { ModeToggle } from '@workspace/ui/custom/mode-toggle';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { DashboardLayout } from '@workspace/ui/custom/layouts/dashboard-layout';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { ListDetailLayout } from '@workspace/ui/custom/layouts/list-detail-layout';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  FormLayout,
  FormSection,
} from '@workspace/ui/custom/layouts/form-layout';
import {
  SettingsLayout,
  SettingsNav,
} from '@workspace/ui/custom/layouts/settings-layout';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { ValidationSummary } from '@workspace/ui/custom/states/validation-summary';
import type {
  StatItem,
  SettingsNavItem,
} from '@workspace/ui/types/layout.types';
import type { ValidationItem } from '@workspace/ui/types/states.types';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';
import { Dot } from '@workspace/ui/custom/data-display/dot';

/* ---------------------------------- data --------------------------------- */

const STATS: StatItem[] = [
  {
    key: 'students',
    label: 'Total students',
    value: '1,420',
    delta: { label: '+3%', direction: 'up', intent: 'positive' },
    hint: 'vs last term',
  },
  { key: 'staff', label: 'Total staff', value: '96' },
  {
    key: 'revenue',
    label: 'Revenue (mo)',
    value: '₦12.4M',
    delta: { label: '+9%', direction: 'up', intent: 'positive' },
  },
  {
    key: 'fees',
    label: 'Outstanding fees',
    value: '₦3.1M',
    delta: { label: '+4%', direction: 'up', intent: 'negative' },
    hint: '142 students',
  },
  {
    key: 'attendance',
    label: 'Attendance',
    value: '94%',
    delta: { label: '0%', direction: 'flat' },
  },
];

const STUDENTS = [
  {
    id: 's1',
    name: 'Maya Okafor',
    klass: '11B',
    guardian: 'A. Okafor',
    status: 'Active',
  },
  {
    id: 's2',
    name: 'Liam Chen',
    klass: '10A',
    guardian: 'R. Chen',
    status: 'Active',
  },
  {
    id: 's3',
    name: 'Aisha Bello',
    klass: '11B',
    guardian: 'F. Bello',
    status: 'Suspended',
  },
  {
    id: 's4',
    name: 'Noah Adeyemi',
    klass: '9C',
    guardian: 'G. Adeyemi',
    status: 'Active',
  },
  {
    id: 's5',
    name: 'Sara Mensah',
    klass: '10A',
    guardian: 'P. Mensah',
    status: 'Active',
  },
];

const SETTINGS_SECTIONS = [
  {
    key: 'general',
    label: 'General',
    description: 'Name, type, timezone',
    icon: <SlidersHorizontal />,
  },
  {
    key: 'people',
    label: 'People & roles',
    description: 'Members, permissions',
    icon: <Users />,
  },
  {
    key: 'billing',
    label: 'Billing',
    description: 'Plan & invoices',
    icon: <CreditCard />,
  },
  {
    key: 'security',
    label: 'Security',
    description: 'Access, sessions',
    icon: <Shield />,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Email & in-app',
    icon: <Bell />,
  },
];

type TableState = 'data' | 'loading' | 'empty';

/* -------------------------------- sections ------------------------------- */

function DashboardDemo() {
  return (
    <DashboardLayout
      header={
        <PageHeader
          title="Good morning, Mr Bello"
          meta={[
            { key: 'term', label: 'Term 3 · 2026' },
            { key: 'type', label: 'Secondary', emphasis: true },
          ]}
          padded={false}
          actions={
            <Button size="sm">
              <Plus aria-hidden />
              Add student
            </Button>
          }
        />
      }
      stats={<StatGrid items={STATS} />}
      aside={
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2.5">
              {['Add student', 'Add staff', 'Send notice', 'View reports'].map(
                (a) => (
                  <Button
                    key={a}
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    {a}
                  </Button>
                ),
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                '₦240k fees collected',
                'New admission: J. Cole',
                'Term reports published',
              ].map((a) => (
                <div key={a} className="flex items-center gap-2.5">
                  <span className="size-1.5 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{a}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Needs attention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            ['38 admission applications', 'Pending review'],
            ['₦3.1M outstanding fees', '142 students'],
            ['6 staff on leave today', '2 unfilled classes'],
          ].map(([t, s]) => (
            <div
              key={t}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border px-3 py-2.5"
            >
              <div>
                <div className="font-medium text-foreground">{t}</div>
                <div className="text-[calc(12px*var(--font-scale))] text-muted-foreground">
                  {s}
                </div>
              </div>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollment growth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-end gap-2">
            {[40, 52, 48, 61, 68, 74, 80, 96].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-primary/70"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

function ListDetailDemo() {
  const [selected, setSelected] = React.useState<string | null>('s1');
  const active = STUDENTS.find((s) => s.id === selected) ?? null;

  return (
    <ListDetailLayout
      showDetail={Boolean(selected)}
      list={
        <ul className="divide-y divide-border">
          {STUDENTS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelected(s.id)}
                aria-current={s.id === selected ? 'true' : undefined}
                className={
                  'flex w-full flex-col gap-0.5 px-4 py-3 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 ' +
                  (s.id === selected ? 'bg-secondary' : 'hover:bg-accent/50')
                }
              >
                <span className="text-sm font-medium text-foreground">
                  {s.name}
                </span>
                <span className="text-[calc(12px*var(--font-scale))] text-muted-foreground">
                  {s.klass}
                  <Dot />
                  Guardian {s.guardian}
                </span>
              </button>
            </li>
          ))}
        </ul>
      }
      detail={
        active ? (
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {active.name}
                </h3>
                <p className="text-[calc(12.5px*var(--font-scale))] text-muted-foreground">
                  Class {active.klass}
                  <Dot />
                  Guardian {active.guardian}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="md:hidden"
                onClick={() => setSelected(null)}
              >
                Back
              </Button>
            </div>
            <StatusBadge
              tone={active.status === 'Active' ? 'success' : 'warning'}
              dot
              className="mt-3"
            >
              {active.status}
            </StatusBadge>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Student ID', active.id.toUpperCase()],
                ['Class', active.klass],
                ['Guardian', active.guardian],
                ['Attendance', '96%'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[calc(12px*var(--font-scale))] text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="font-medium text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <div className="grid h-full place-items-center p-8 text-sm text-muted-foreground">
            Select a student to see details.
          </div>
        )
      }
    />
  );
}

type Student = (typeof STUDENTS)[number];

/**
 * Canonical table pattern. Use `DirectoryTable` (not raw `<Table>`) for any
 * list of records: it ships the Pattern-B toolbar (search + Filters button +
 * applied-filter pills), column show/hide, sortable headers, selection, paging
 * and the loading/empty/error states — all consistent across the app. Status
 * cells use `StatusBadge` (tone-driven pill), never a raw `<Badge>`.
 */
function TableDemo() {
  const [demoState, setDemoState] = React.useState<TableState>('data');
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const columns: DirectoryColumn<Student>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      cell: (s) => (
        <span className="font-medium text-foreground">{s.name}</span>
      ),
    },
    { id: 'klass', header: 'Class', hideable: true, cell: (s) => s.klass },
    {
      id: 'guardian',
      header: 'Guardian',
      hideable: true,
      cell: (s) => s.guardian,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (s) => (
        <StatusBadge tone={s.status === 'Active' ? 'success' : 'warning'} dot>
          {s.status}
        </StatusBadge>
      ),
    },
  ];

  // Filter + sort the mock rows in-memory so the demo actually responds.
  const rows = React.useMemo(() => {
    if (demoState === 'empty') return [];
    const q = term.trim().toLowerCase();
    let out = STUDENTS.filter((s) => {
      const matchesQ =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.guardian.toLowerCase().includes(q);
      const status = filters.status;
      return matchesQ && (!status || s.status === status);
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      const field = sort.field as keyof Student;
      out = [...out].sort(
        (a, b) => dir * String(a[field]).localeCompare(String(b[field])),
      );
    }
    return out;
  }, [demoState, term, filters, sort]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(['data', 'loading', 'empty'] as TableState[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={demoState === s ? 'default' : 'outline'}
            onClick={() => setDemoState(s)}
          >
            {s}
          </Button>
        ))}
      </div>
      <DirectoryTable<Student>
        title="Students"
        description={demoState === 'empty' ? 'No students' : '1,420 students'}
        columns={columns}
        rows={rows}
        getRowId={(s) => s.id}
        getRowLabel={(s) => s.name}
        total={demoState === 'empty' ? 0 : 1420}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sort={sort}
        onSortChange={(field) =>
          setSort((cur) =>
            cur?.field !== field
              ? { field, dir: 'asc' }
              : cur.dir === 'asc'
                ? { field, dir: 'desc' }
                : null,
          )
        }
        loading={demoState === 'loading'}
        caption="Students directory (design-system demo)"
        search={{
          value: term,
          onChange: setTerm,
          placeholder: 'Search students…',
          label: 'Search students',
        }}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'Active', label: 'Active' },
              { value: 'Suspended', label: 'Suspended' },
            ],
          },
        ]}
        filterValues={filters}
        onFilterChange={(key, value) =>
          setFilters((f) => ({ ...f, [key]: value }))
        }
        onClearFilters={() => setFilters({})}
        toolbarActions={
          <Button size="sm">
            <Plus aria-hidden /> Add
          </Button>
        }
        emptyState={
          <EmptyState
            compact
            title="No students match"
            description="Try clearing filters or add a new student."
          />
        }
      />
    </div>
  );
}

function FormDemo() {
  const [items, setItems] = React.useState<ValidationItem[]>([]);
  const [autoFocus, setAutoFocus] = React.useState(false);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    const name = (
      document.getElementById('f-name') as HTMLInputElement
    )?.value.trim();
    const email = (
      document.getElementById('f-email') as HTMLInputElement
    )?.value.trim();
    const next: ValidationItem[] = [];
    if (!name)
      next.push({
        key: 'n',
        fieldId: 'f-name',
        message: 'Student name is required.',
      });
    if (!email?.includes('@'))
      next.push({
        key: 'e',
        fieldId: 'f-email',
        message: 'Enter a valid guardian email.',
      });
    setAutoFocus(true);
    setItems(next);
  };

  return (
    <FormLayout
      onSubmit={onSubmit}
      validation={
        <ValidationSummary
          title="Please fix the following before saving"
          items={items}
          autoFocus={autoFocus}
        />
      }
      aside={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-[calc(12.5px*var(--font-scale))] leading-relaxed text-muted-foreground">
            The guardian email receives invoices and term reports. You can add
            more contacts after the student is created.
          </CardContent>
        </Card>
      }
      actions={
        <>
          <Button type="button" variant="outline">
            Cancel
          </Button>
          <Button type="submit">Save student</Button>
        </>
      }
    >
      <FormSection
        title="Identity"
        description="Basic details used across the student record."
        columns={2}
      >
        <div className="grid gap-2">
          <Label htmlFor="f-name">Student name</Label>
          <Input id="f-name" placeholder="e.g. Maya Okafor" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="f-class">Class</Label>
          <Input id="f-class" placeholder="e.g. 11B" />
        </div>
      </FormSection>
      <FormSection
        title="Guardian"
        description="Primary contact for billing and communication."
        columns={2}
      >
        <div className="grid gap-2">
          <Label htmlFor="f-guardian">Guardian name</Label>
          <Input id="f-guardian" placeholder="e.g. A. Okafor" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="f-email">Guardian email</Label>
          <Input id="f-email" type="email" placeholder="guardian@example.com" />
        </div>
      </FormSection>
    </FormLayout>
  );
}

function SettingsDemo() {
  const [section, setSection] = React.useState('general');
  const nav: SettingsNavItem[] = SETTINGS_SECTIONS.map((s) => ({
    ...s,
    active: s.key === section,
    onSelect: () => setSection(s.key),
  }));
  const current = SETTINGS_SECTIONS.find((s) => s.key === section)!;

  return (
    <SettingsLayout nav={<SettingsNav items={nav} />}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCog aria-hidden className="size-4 text-muted-foreground" />
            {current.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[calc(12.5px*var(--font-scale))] text-muted-foreground">
            {current.description} — settings for the “{current.label}” section
            render here. Switch sections in the nav; the active item is marked
            with <code>aria-current</code>.
          </p>
          <div className="divide-y divide-border rounded-[var(--radius-sm)] border border-border">
            {['Display name', 'Institution type', 'Default timezone'].map(
              (row) => (
                <div
                  key={row}
                  className="flex items-center justify-between gap-3 px-3.5 py-3"
                >
                  <span className="text-sm text-foreground">{row}</span>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>
    </SettingsLayout>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function LayoutsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Layout Patterns</h1>
          <p className="text-sm text-muted-foreground">
            Reusable authenticated-surface layouts composed from shared
            primitives, the shell page header, and the M5 state components.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/design-system">← Design system</Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="list-detail">List / detail</TabsTrigger>
          <TabsTrigger value="table">Data table</TabsTrigger>
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <DashboardDemo />
        </TabsContent>
        <TabsContent value="list-detail">
          <div className="h-[460px]">
            <ListDetailDemo />
          </div>
        </TabsContent>
        <TabsContent value="table">
          <TableDemo />
        </TabsContent>
        <TabsContent value="form">
          <FormDemo />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsDemo />
        </TabsContent>
      </Tabs>
    </main>
  );
}
