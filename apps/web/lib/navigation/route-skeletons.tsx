'use client';

/* ============================================================
   Route skeletons — the destination's shape, from the click

   A click must paint the DESTINATION's placeholder, but the router will
   not commit for hundreds of milliseconds, so the destination's own
   `loading.tsx` cannot be what renders it. Something in the shell must.
   If that something invents a generic shape, the reader sees it replaced
   by the tailored one a moment later — two loaders for one wait.

   WHY THIS IS A COPY, reluctantly. The obvious move is for the shell to
   render each route's own `loading.tsx`. It cannot: those files are free
   to be SERVER components, and several are (`overview` reads the session;
   others reach `lib/session`, which imports `next/headers`). Importing
   them from a client module drags server-only code into the client graph
   and the whole app stops compiling — tried, and it did exactly that.

   So the shapes are re-declared here in a client-safe module, and
   `scripts/audit-route-skeletons.mjs` fails the build if this file and a
   route's real `loading.tsx` ever disagree. The duplication is real; the
   audit is what keeps it honest.

   Regenerate after adding a nav destination, then run the audit.
   ============================================================ */

import * as React from 'react';

import {
  DashboardPageSkeleton,
  DetailPageSkeleton,
  FormPageSkeleton,
  ListDetailPageSkeleton,
  ReportPageSkeleton,
  TablePageSkeleton,
} from '@workspace/ui/custom/states/page-skeletons';

import { useViewer } from '@/app/providers/viewer-provider';
import {
  DASHBOARD_SHAPES,
  dashboardKindFor,
} from '@/app/(app)/overview/dashboard-shape';

/** Nav destination → the shape its own `loading.tsx` renders. */
const ROUTE_SKELETONS: Record<string, () => React.ReactElement> = {
  '/academics/lessons': () => (
    <DetailPageSkeleton
      sections={2}
      withStats={false}
      actions={1}
      withTabs={2}
    />
  ),
  '/academics/lifecycle': () => (
    <DetailPageSkeleton
      sections={2}
      withStats={false}
      actions={1}
      withTabs={2}
    />
  ),
  '/academics/promotion': () => (
    <DetailPageSkeleton sections={2} withStats={false} actions={1} />
  ),
  '/academics/results': () => (
    <DetailPageSkeleton sections={2} withStats={false} actions={1} />
  ),
  '/academics/structure': () => (
    <DetailPageSkeleton sections={3} withStats={false} actions={1} />
  ),
  '/academics/transcripts': () => (
    <DetailPageSkeleton sections={2} withStats={false} actions={1} />
  ),
  '/attendance/daily': () => (
    <TablePageSkeleton rows={8} columns={3} actions={2} />
  ),
  '/attendance/students': () => (
    <TablePageSkeleton rows={8} columns={5} actions={1} />
  ),
  '/classes/assessments': () => <ListDetailPageSkeleton actions={1} />,
  '/classes/assessments/take': () => <TablePageSkeleton columns={5} rows={8} />,
  '/classes/gradebook': () => (
    <TablePageSkeleton rows={8} columns={6} actions={1} />
  ),
  '/classes/materials': () => <TablePageSkeleton rows={8} columns={6} />,
  '/classes/question-bank': () => <ListDetailPageSkeleton actions={1} />,
  '/classes/review': () => <ListDetailPageSkeleton actions={2} />,
  '/classes/subjects': () => (
    <TablePageSkeleton rows={8} columns={5} actions={1} />
  ),
  '/classes/teachers': () => <TablePageSkeleton columns={5} rows={8} />,
  '/classes/timetable': () => (
    <DetailPageSkeleton sections={2} withStats={false} actions={1} />
  ),
  '/events/upcoming': () => (
    <TablePageSkeleton rows={8} columns={6} stats={4} actions={1} />
  ),
  '/finance/approvals': () => (
    <TablePageSkeleton rows={6} columns={8} stats={0} />
  ),
  '/finance/discount-policies': () => (
    <TablePageSkeleton rows={5} columns={5} actions={1} />
  ),
  '/finance/fee-items': () => (
    <TablePageSkeleton rows={8} columns={5} actions={1} />
  ),
  '/finance/households': () => (
    <TablePageSkeleton rows={6} columns={5} actions={2} />
  ),
  '/finance/invoices': () => (
    <TablePageSkeleton rows={8} columns={8} stats={5} actions={2} />
  ),
  '/finance/ledger': () => (
    <TablePageSkeleton columns={9} stats={4} actions={2} />
  ),
  '/finance/payments': () => (
    <TablePageSkeleton rows={8} columns={6} stats={3} actions={1} />
  ),
  '/finance/reports': () => <ReportPageSkeleton stats={5} charts={2} />,
  '/health/records': () => (
    <TablePageSkeleton rows={8} columns={5} stats={4} actions={1} />
  ),
  '/hr/directory': () => <TablePageSkeleton columns={5} rows={8} />,
  '/hr/leave': () => <TablePageSkeleton columns={5} rows={8} />,
  '/hr/payroll': () => (
    <TablePageSkeleton rows={8} columns={5} stats={4} actions={1} />
  ),
  '/library/books': () => (
    <TablePageSkeleton rows={8} columns={5} stats={4} actions={1} />
  ),
  '/library/loans': () => <TablePageSkeleton rows={8} columns={6} />,
  '/people': () => (
    <TablePageSkeleton rows={8} columns={4} stats={6} actions={1} />
  ),
  '/platform/analytics': () => <ReportPageSkeleton stats={4} charts={2} />,
  '/platform/analytics/assistant': () => (
    <DetailPageSkeleton withStats={false} sections={2} />
  ),
  '/platform/audit/log': () => <TablePageSkeleton columns={5} rows={8} />,
  '/platform/settings/policies': () => (
    <TablePageSkeleton rows={6} columns={6} />
  ),
  '/platform/settings/security': () => <FormPageSkeleton fields={5} />,
  '/platform/tenants/all': () => <TablePageSkeleton rows={8} columns={4} />,
  '/platform/tenants/approvals': () => (
    <TablePageSkeleton columns={5} rows={8} />
  ),
  '/platform/tenants/onboarding': () => <FormPageSkeleton fields={6} />,
  '/reports/academic': () => (
    <ReportPageSkeleton stats={4} charts={2} actions={1} />
  ),
  '/reports/analytics': () => (
    <ReportPageSkeleton stats={4} charts={2} actions={1} />
  ),
  '/settings/ai-usage': () => <DetailPageSkeleton sections={3} withStats />,
  '/settings/audit': () => <TablePageSkeleton rows={8} columns={6} />,
  '/settings/branding': () => <FormPageSkeleton fields={5} />,
  '/settings/features': () => <FormPageSkeleton fields={6} />,
  '/settings/general': () => <FormPageSkeleton fields={6} />,
  '/settings/roles': () => <TablePageSkeleton rows={6} columns={3} />,
  '/settings/security': () => <FormPageSkeleton fields={5} />,
  '/settings/users': () => <TablePageSkeleton rows={8} columns={4} />,
  '/students/admissions': () => (
    <TablePageSkeleton rows={6} columns={5} actions={2} />
  ),
  '/students/directory': () => (
    <TablePageSkeleton rows={8} columns={6} actions={1} />
  ),
  '/students/fees': () => (
    <TablePageSkeleton rows={8} columns={6} stats={3} actions={1} />
  ),
  '/students/gradebook/standing': () => (
    <TablePageSkeleton rows={8} columns={6} actions={1} />
  ),
  '/transport/pickups': () => <TablePageSkeleton rows={8} columns={6} />,
  '/transport/riders': () => (
    <TablePageSkeleton rows={8} columns={5} actions={1} />
  ),
  '/transport/routes': () => <TablePageSkeleton rows={8} columns={6} />,
};

/** Nav destinations that only redirect, mapped to where they land. */
const REDIRECTS: Record<string, string> = {
  '/classes': '/classes/timetable',
  '/events': '/events/upcoming',
  '/finance': '/finance/invoices',
  '/health': '/health/records',
  '/hr': '/hr/payroll',
  '/library': '/library/books',
  '/platform/tenants': '/platform/tenants/all',
  '/reports': '/reports/academic',
};

/**
 * Overview picks its shape from the viewer's clearance, exactly as its own
 * `loading.tsx` does — both read `DASHBOARD_SHAPES`, so they cannot drift.
 */
function OverviewSkeleton() {
  const { viewer } = useViewer();
  const shape =
    DASHBOARD_SHAPES[dashboardKindFor(viewer.scope, viewer.clearanceLevel)];
  return <DashboardPageSkeleton {...shape} />;
}

/**
 * The placeholder for a pending navigation, or null when the destination has
 * no skeleton of its own — the caller decides what to show instead.
 */
export function RouteSkeleton({ href }: { href: string | null }) {
  const path = href ? (href.split('?')[0] ?? href) : null;
  const target = path ? (REDIRECTS[path] ?? path) : null;
  if (target === '/overview') return <OverviewSkeleton />;
  const exact = target ? ROUTE_SKELETONS[target] : undefined;
  if (exact) return exact();
  // Longest prefix, so a nested route falls back to its section's shape.
  let best: string | null = null;
  if (target) {
    for (const key of Object.keys(ROUTE_SKELETONS)) {
      if (
        target.startsWith(key + '/') &&
        (best === null || key.length > best.length)
      )
        best = key;
    }
  }
  const fallback = best ? ROUTE_SKELETONS[best] : undefined;
  return fallback ? fallback() : null;
}

/** Whether a destination has a shape of its own (used by the audit + shell). */
export function hasRouteSkeleton(href: string | null): boolean {
  if (!href) return false;
  const path = href.split('?')[0] ?? href;
  const target = REDIRECTS[path] ?? path;
  if (target === '/overview') return true;
  if (ROUTE_SKELETONS[target]) return true;
  return Object.keys(ROUTE_SKELETONS).some((k) => target.startsWith(k + '/'));
}
