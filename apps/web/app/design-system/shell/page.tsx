'use client';

/* ============================================================
   /design-system/shell — Aurora Layout A shell preview

   Full-bleed integration surface for the shell components. ALL
   sample data lives here, in the preview — the shell components
   carry none (resolves TD-001).

   Milestone 4: the sidebar is now driven by the navigation model
   (@workspace/ui/lib/navigation). Pick a viewer persona to watch
   role / clearance / permission / scope filtering, and click any
   destination to see active state follow the route — no hardcoded
   `active` flags. Sample configs live in `navigation.data.tsx`.
   ============================================================ */

import * as React from 'react';
import {
  Bell,
  CircleQuestionMark,
  ListFilter,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { AppShell, ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { AppHeader, OmniSearch } from '@workspace/ui/custom/shell/app-header';
import { AppSidebar } from '@workspace/ui/custom/shell/app-sidebar';
import { SchoolSwitcher } from '@workspace/ui/custom/shell/school-switcher';
import { UserMenu } from '@workspace/ui/custom/shell/user-menu';
import { AppBreadcrumbs } from '@workspace/ui/custom/shell/app-breadcrumbs';
import {
  PageHeader,
  SegmentedControl,
} from '@workspace/ui/custom/shell/page-header';
import { resolveNavigation } from '@workspace/ui/lib/navigation';
import type {
  BreadcrumbEntry,
  NavItem,
  PageHeaderMeta,
  SchoolOption,
  UserMenuItem,
  UserProfile,
} from '@workspace/ui/types/shell.types';

import { VIEWERS, configForViewer } from './navigation.data';

/* ---- sample data (preview-only) ------------------------------ */
const SCHOOLS: SchoolOption[] = [
  {
    id: 'sja',
    name: 'St. Jude Academy',
    initials: 'SJ',
    caption: 'Secondary · Spring Term 2025',
    color: '#4f6df5',
  },
  {
    id: 'mge',
    name: 'Maple Grove Elementary',
    initials: 'MG',
    caption: 'Primary · 612 students',
    color: '#12b886',
  },
  {
    id: 'rhc',
    name: 'Riverside Heights College',
    initials: 'RH',
    caption: 'College · 2,140 students',
    color: '#8c5cff',
  },
];

const USER: UserProfile = {
  name: 'Bisi Eze',
  email: 'registrar@stjude.edu',
  initials: 'BE',
  caption: 'Registrar',
  color: '#334155',
};

const USER_MENU: UserMenuItem[] = [
  { key: 'profile', label: 'Profile', icon: <User /> },
  { key: 'settings', label: 'Account settings', icon: <Settings /> },
  {
    key: 'signout',
    label: 'Sign out',
    icon: <LogOut />,
    destructive: true,
    separatorBefore: true,
  },
];

const PAGE_META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
  { key: 'pending', label: '42 pending review' },
  { key: 'updated', label: 'updated 2m ago' },
];

const VIEW_OPTIONS = [
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'list', label: 'List' },
  { key: 'calendar', label: 'Calendar' },
];

/* ---- preview-only chrome fragments --------------------------- */
function NavFooterCard() {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-card p-3 shadow-card">
      <div className="text-[12.5px] font-bold text-foreground">Spring intake</div>
      <div className="h-1.5 overflow-hidden rounded bg-muted">
        <div className="h-full rounded bg-primary" style={{ width: '93%' }} />
      </div>
      <div className="text-[11.5px] leading-snug text-muted-foreground">
        446 of 480 seats confirmed · 34 open
      </div>
    </div>
  );
}

function HeaderActions() {
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Quick add">
        <Plus />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Notifications"
        className="relative"
      >
        <Bell />
        <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-info text-[10px] font-bold text-info-foreground">
          3
        </span>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Help"
        className="max-md:hidden"
      >
        <CircleQuestionMark />
      </Button>
      <div className="mx-0.5 h-5 w-px bg-border max-md:hidden" />
      <UserMenu user={USER} items={USER_MENU} />
    </>
  );
}

function Inspector() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        Applicant
      </span>
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-[14px] bg-[#e0654a] text-sm font-bold text-white">
          AR
        </span>
        <div>
          <h3 className="text-[17px] font-extrabold leading-tight text-foreground">
            Alex Rivera
          </h3>
          <div className="text-xs text-muted-foreground">Grade 9 · #2025-0428</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">Pending review</Badge>
        <Badge variant="secondary">In-zone</Badge>
      </div>
      <div className="mt-1 flex flex-col gap-2.5 text-[13px]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
            Guardian
          </span>
          <span className="text-foreground">Daniela Rivera</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
            Prior school
          </span>
          <span className="text-foreground">Maple Grove Elementary</span>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
        <Button className="w-full">
          <UserPlus /> Enroll &amp; invite
        </Button>
      </div>
    </div>
  );
}

function StatusBar({ note }: { note: string }) {
  return (
    <div className="flex h-[30px] shrink-0 items-center gap-3.5 border-t border-border bg-sidebar px-4 text-[11.5px] font-medium text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-[7px] rounded-full bg-success ring-2 ring-success/30" />
        Synced · 2m ago
      </span>
      <span className="font-bold text-foreground/80">{note}</span>
      <span className="hidden sm:inline">3 background jobs</span>
      <span className="ml-auto inline-flex items-center gap-1.5">
        <kbd className="rounded border border-border px-1.5 py-px text-[10.5px] font-semibold">
          ⌘K
        </kbd>
        to jump anywhere
      </span>
    </div>
  );
}

/** Preview tool: switch the viewer persona to demonstrate access filtering. */
function PersonaSwitcher({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="h-8 w-[172px] text-[13px] max-md:hidden"
        aria-label="Preview as persona"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {VIEWERS.map((p) => (
          <SelectItem key={p.key} value={p.key}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ---- helpers ------------------------------------------------- */
/** Find the deepest active nav item (for the page title / breadcrumb). */
function findActiveItem(items: NavItem[]): NavItem | undefined {
  for (const item of items) {
    const child = item.items ? findActiveItem(item.items) : undefined;
    if (child) return child;
    if (item.active) return item;
  }
  return undefined;
}

/* ---- composed preview ---------------------------------------- */
export default function ShellPreviewPage() {
  const [activeSchool, setActiveSchool] = React.useState(SCHOOLS[0]!.id);
  const [personaKey, setPersonaKey] = React.useState(VIEWERS[0]!.key);
  const [view, setView] = React.useState('pipeline');

  const persona = VIEWERS.find((p) => p.key === personaKey) ?? VIEWERS[0]!;
  const viewer = persona.viewer;
  const config = configForViewer(viewer);

  // Active route is simulated in-page so the preview is self-contained:
  // selecting a destination updates the path and active state re-derives.
  // Opens on Students › Enrollment to match the approved Aurora design.
  const [currentPath, setCurrentPath] = React.useState('/students/enrollment');

  // When the persona changes, the config may change — land on its first section.
  const onPersona = (key: string) => {
    const next = VIEWERS.find((p) => p.key === key) ?? VIEWERS[0]!;
    setPersonaKey(key);
    setCurrentPath(configForViewer(next.viewer).sections[0]?.href ?? '/');
  };

  const nav = resolveNavigation(config, viewer, currentPath, {
    onNavigate: setCurrentPath,
  });

  const activeItem = findActiveItem(nav.navGroups.flatMap((g) => g.items));
  const sectionTitle = nav.navHeader?.title ?? 'Overview';
  const pageTitle = activeItem?.label ?? sectionTitle;

  const tenantName =
    viewer.scope === 'platform'
      ? 'Platform'
      : (SCHOOLS.find((s) => s.id === viewer.tenantId)?.name ?? 'All schools');

  const breadcrumbs: BreadcrumbEntry[] = [
    { key: 'section', label: sectionTitle, href: '#' },
    ...(activeItem ? [{ key: 'leaf', label: activeItem.label }] : []),
  ];

  return (
    <div className="h-svh w-full">
      <AppShell
        header={
          <AppHeader
            schoolSwitcher={
              <SchoolSwitcher
                schools={SCHOOLS}
                activeSchoolId={activeSchool}
                onSchoolChange={(s) => setActiveSchool(s.id)}
                onAddSchool={() => {}}
              />
            }
            breadcrumbs={<AppBreadcrumbs items={breadcrumbs} />}
            search={
              <OmniSearch placeholder="Search students, classes, records…" />
            }
            actions={<HeaderActions />}
          />
        }
        sidebar={
          <AppSidebar
            brand={
              <span className="grid size-[30px] place-items-center rounded-[9px] bg-primary text-primary-foreground shadow-accent">
                <Sparkles className="size-4" />
              </span>
            }
            railItems={nav.railItems}
            railFooterItems={nav.railFooterItems}
            navHeader={
              nav.navHeader
                ? { ...nav.navHeader, subtitle: tenantName }
                : undefined
            }
            navGroups={nav.navGroups}
            navFooter={
              nav.activeSectionKey === 'students' ? <NavFooterCard /> : undefined
            }
          />
        }
        inspector={<Inspector />}
        statusBar={<StatusBar note={`${persona.label} · ${tenantName}`} />}
      >
        <PageHeader
          title={pageTitle}
          meta={PAGE_META}
          actions={
            <>
              <PersonaSwitcher value={personaKey} onChange={onPersona} />
              <SegmentedControl
                options={VIEW_OPTIONS}
                value={view}
                onValueChange={setView}
                className="max-md:hidden"
              />
              <Button variant="outline" size="sm" className="max-md:hidden">
                <ListFilter /> Filter
              </Button>
              <Button size="sm">
                <Plus /> New
              </Button>
            </>
          }
        />
        <ShellMain>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'New applicants', value: '128', foot: '+12% vs last term' },
              { label: 'Seats remaining', value: '34', foot: '446 confirmed' },
              { label: 'Avg. processing', value: '3.2d', foot: 'faster than target' },
              { label: 'Offer acceptance', value: '78%', foot: '142 of 182 offers' },
            ].map((kpi) => (
              <Card key={kpi.label} className="shadow-card">
                <CardHeader>
                  <CardDescription>{kpi.label}</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {kpi.value}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {kpi.foot}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="flex-1 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">
                Navigation model · {persona.label}
              </CardTitle>
              <CardDescription>
                Active route: <code>{currentPath}</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              The sidebar is resolved from a typed navigation config filtered by
              the selected persona&apos;s clearance, permissions, and scope —
              the shell components receive no roles or tenant logic. Switch
              personas to watch destinations appear and disappear, and select
              any item to see active state follow the route. Content panels
              themselves are Milestone 6 territory.
            </CardContent>
          </Card>
        </ShellMain>
      </AppShell>
    </div>
  );
}
