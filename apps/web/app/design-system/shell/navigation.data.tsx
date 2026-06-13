/* ============================================================
   /design-system/shell — example navigation data (PREVIEW ONLY)

   Demonstrates the M4 navigation model: declarative configs whose
   nodes carry access guards (clearance / permission / scope /
   school type), plus a few example viewer personas. The shell
   itself carries none of this — `resolveNavigation` (from
   @workspace/ui/lib/navigation) filters a config for a viewer and
   derives active state from the route. Not product data.
   ============================================================ */

import {
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  ChartColumn,
  CircleQuestionMark,
  Contact,
  CreditCard,
  GraduationCap,
  LayoutGrid,
  LifeBuoy,
  ScrollText,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

import type {
  PermissionKey,
  ViewerContext,
} from '@workspace/ui/types/access.types';
import type { NavigationConfig } from '@workspace/ui/types/navigation.types';

/* ---- school-level navigation --------------------------------- */
export const SCHOOL_NAV: NavigationConfig = {
  scope: 'school',
  sections: [
    {
      key: 'overview',
      label: 'Overview',
      icon: <LayoutGrid />,
      href: '/overview',
      access: { minClearance: 1 },
      panelHeader: { icon: <LayoutGrid />, title: 'Overview' },
      groups: [
        {
          key: 'home',
          items: [
            { key: 'dashboard', label: 'Dashboard', icon: <LayoutGrid />, href: '/overview' },
            { key: 'tasks', label: 'My tasks', icon: <ScrollText />, href: '/overview/tasks' },
          ],
        },
      ],
    },
    {
      key: 'students',
      label: 'Students',
      icon: <Users />,
      href: '/students',
      access: { anyPermission: ['students.view'] },
      panelHeader: { icon: <Users />, title: 'Students' },
      groups: [
        {
          key: 'records',
          label: 'Records',
          items: [
            {
              key: 'enrollment',
              label: 'Enrollment',
              icon: <UserPlus />,
              href: '/students/enrollment',
              badge: '42',
              badgeTone: 'hot',
              access: { anyPermission: ['admissions.view'] },
            },
            {
              key: 'directory',
              label: 'Directory',
              icon: <Contact />,
              href: '/students/directory',
              badge: '1.2k',
              access: { anyPermission: ['students.view'] },
            },
            {
              key: 'attendance',
              label: 'Attendance',
              icon: <CalendarDays />,
              href: '/students/attendance',
              access: { anyPermission: ['attendance.view'] },
            },
          ],
        },
        {
          key: 'academics',
          label: 'Academics',
          collapsible: true,
          access: { anyPermission: ['grades.view', 'transcripts.view'] },
          items: [
            {
              key: 'gradebook',
              label: 'Gradebook',
              icon: <BookOpen />,
              href: '/students/gradebook',
              access: { anyPermission: ['grades.view'] },
              items: [
                {
                  key: 'reportcards',
                  label: 'Report cards',
                  href: '/students/gradebook/report-cards',
                  access: { anyPermission: ['grades.view'] },
                },
                {
                  key: 'transcripts',
                  label: 'Transcripts',
                  href: '/students/gradebook/transcripts',
                  access: { anyPermission: ['transcripts.view'] },
                },
              ],
            },
          ],
        },
        {
          key: 'student-ops',
          label: 'Operations',
          items: [
            {
              key: 'fees',
              label: 'Fees & billing',
              icon: <CreditCard />,
              href: '/students/fees',
              badge: '7',
              access: { anyPermission: ['fees.view'] },
            },
            {
              key: 'transport',
              label: 'Transport',
              icon: <CalendarDays />,
              href: '/students/transport',
              access: { anyPermission: ['transportation.view'] },
            },
          ],
        },
      ],
    },
    {
      key: 'classes',
      label: 'Classes',
      icon: <BookOpen />,
      href: '/classes',
      access: { anyPermission: ['courses.view', 'schedules.view'] },
      panelHeader: { icon: <BookOpen />, title: 'Classes' },
      groups: [
        {
          key: 'teaching',
          label: 'Teaching',
          items: [
            { key: 'timetable', label: 'Timetable', icon: <CalendarDays />, href: '/classes/timetable', access: { anyPermission: ['timetable.view'] } },
            { key: 'gradebook', label: 'Gradebook', icon: <BookOpen />, href: '/classes/gradebook', access: { anyPermission: ['grades.view'] } },
            { key: 'subjects', label: 'Subjects', icon: <GraduationCap />, href: '/classes/subjects', access: { anyPermission: ['subjects.view', 'courses.view'] } },
          ],
        },
      ],
    },
    {
      key: 'attendance',
      label: 'Attendance',
      icon: <CalendarDays />,
      href: '/attendance',
      access: { anyPermission: ['attendance.view'] },
      panelHeader: { icon: <CalendarDays />, title: 'Attendance' },
      groups: [
        {
          key: 'attendance-views',
          items: [
            { key: 'daily', label: 'Daily register', icon: <CalendarDays />, href: '/attendance/daily', access: { anyPermission: ['attendance.view'] } },
            { key: 'reports', label: 'Reports', icon: <ChartColumn />, href: '/attendance/reports', access: { anyPermission: ['attendance.export', 'reports.attendance'] } },
          ],
        },
      ],
    },
    {
      key: 'finance',
      label: 'Finance',
      icon: <Wallet />,
      href: '/finance',
      // Financial & Legal access starts at clearance 5 (access-control.md).
      access: { minClearance: 5, anyPermission: ['fees.view', 'financial_reports.view'] },
      panelHeader: { icon: <Wallet />, title: 'Finance' },
      groups: [
        {
          key: 'money',
          label: 'Billing',
          items: [
            { key: 'invoices', label: 'Invoices', icon: <CreditCard />, href: '/finance/invoices', access: { anyPermission: ['billing.view', 'payments.view'] } },
            { key: 'payments', label: 'Payments', icon: <Banknote />, href: '/finance/payments', access: { anyPermission: ['payments.view'] } },
            { key: 'fin-reports', label: 'Reports', icon: <ChartColumn />, href: '/finance/reports', access: { anyPermission: ['financial_reports.view'] } },
          ],
        },
      ],
    },
    {
      key: 'reports',
      label: 'Reports',
      icon: <ChartColumn />,
      href: '/reports',
      access: { anyPermission: ['reports.view', 'analytics.view'] },
      panelHeader: { icon: <ChartColumn />, title: 'Reports & analytics' },
      groups: [
        {
          key: 'insights',
          items: [
            { key: 'academic', label: 'Academic', icon: <GraduationCap />, href: '/reports/academic', access: { anyPermission: ['reports.academic', 'reports.view'] } },
            { key: 'analytics', label: 'Analytics', icon: <ChartColumn />, href: '/reports/analytics', access: { anyPermission: ['analytics.view'] } },
          ],
        },
      ],
    },
  ],
  footer: [
    {
      key: 'help',
      label: 'Help',
      icon: <CircleQuestionMark />,
      href: '/help',
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: <Settings />,
      href: '/settings',
      access: { anyPermission: ['settings.view', 'settings.school'] },
      panelHeader: { icon: <Settings />, title: 'Settings' },
      groups: [
        {
          key: 'workspace',
          label: 'Workspace',
          items: [
            { key: 'general', label: 'General', icon: <Settings />, href: '/settings/general', access: { anyPermission: ['settings.view', 'settings.school'] } },
            { key: 'branding', label: 'Branding', icon: <Settings />, href: '/settings/branding', access: { anyPermission: ['settings.theme'] } },
            { key: 'features', label: 'Features', icon: <Settings />, href: '/settings/features', access: { anyPermission: ['settings.features'] } },
          ],
        },
        {
          key: 'access',
          label: 'Access',
          items: [
            { key: 'roles', label: 'Roles & permissions', icon: <ShieldCheck />, href: '/settings/roles', access: { anyPermission: ['settings.roles'] } },
            { key: 'users', label: 'Users', icon: <Users />, href: '/settings/users', access: { anyPermission: ['settings.users'] } },
            { key: 'audit', label: 'Audit log', icon: <ScrollText />, href: '/settings/audit', access: { anyPermission: ['settings.audit'] } },
          ],
        },
      ],
    },
  ],
};

/* ---- platform-level navigation ------------------------------- */
export const PLATFORM_NAV: NavigationConfig = {
  scope: 'platform',
  sections: [
    {
      key: 'tenants',
      label: 'Tenants',
      icon: <Building2 />,
      href: '/platform/tenants',
      access: { scope: 'platform', anyPermission: ['platform.tenants'] },
      panelHeader: { icon: <Building2 />, title: 'Schools' },
      groups: [
        {
          key: 'schools',
          label: 'Schools',
          items: [
            { key: 'all-schools', label: 'All schools', icon: <Building2 />, href: '/platform/tenants/all', access: { anyPermission: ['platform.tenants'] } },
            { key: 'onboarding', label: 'Onboarding', icon: <UserPlus />, href: '/platform/tenants/onboarding', access: { anyPermission: ['platform.tenants'] } },
          ],
        },
      ],
    },
    {
      key: 'analytics',
      label: 'Analytics',
      icon: <ChartColumn />,
      href: '/platform/analytics',
      access: { scope: 'platform', anyPermission: ['platform.monitoring', 'analytics.advanced'] },
      panelHeader: { icon: <ChartColumn />, title: 'Platform analytics' },
      groups: [
        {
          key: 'health',
          items: [
            { key: 'usage', label: 'Usage', icon: <ChartColumn />, href: '/platform/analytics/usage', access: { anyPermission: ['platform.monitoring', 'analytics.advanced'] } },
            { key: 'performance', label: 'Performance', icon: <ChartColumn />, href: '/platform/analytics/performance', access: { anyPermission: ['platform.monitoring'] } },
          ],
        },
      ],
    },
    {
      key: 'audit',
      label: 'Audit',
      icon: <ShieldCheck />,
      href: '/platform/audit',
      access: { scope: 'platform', anyPermission: ['platform.audit', 'platform.audit.limited'] },
      panelHeader: { icon: <ShieldCheck />, title: 'Audit & security' },
      groups: [
        {
          key: 'trail',
          items: [
            { key: 'audit-log', label: 'Audit log', icon: <ScrollText />, href: '/platform/audit/log', access: { anyPermission: ['platform.audit', 'platform.audit.limited'] } },
            { key: 'security', label: 'Security', icon: <ShieldCheck />, href: '/platform/audit/security', access: { anyPermission: ['platform.security'] } },
          ],
        },
      ],
    },
    {
      key: 'support',
      label: 'Support',
      icon: <LifeBuoy />,
      href: '/platform/support',
      access: { scope: 'platform', anyPermission: ['platform.support', 'platform.support.access'] },
      panelHeader: { icon: <LifeBuoy />, title: 'Support' },
      groups: [
        {
          key: 'tickets',
          items: [
            { key: 'queue', label: 'Ticket queue', icon: <LifeBuoy />, href: '/platform/support/queue', access: { anyPermission: ['platform.support', 'platform.support.access'] } },
          ],
        },
      ],
    },
    {
      key: 'billing',
      label: 'Billing',
      icon: <CreditCard />,
      href: '/platform/billing',
      access: { scope: 'platform', anyPermission: ['platform.billing'] },
      panelHeader: { icon: <CreditCard />, title: 'Platform billing' },
      groups: [
        {
          key: 'subscriptions',
          items: [
            { key: 'plans', label: 'Plans', icon: <CreditCard />, href: '/platform/billing/plans', access: { anyPermission: ['platform.billing'] } },
            { key: 'invoices', label: 'Invoices', icon: <Banknote />, href: '/platform/billing/invoices', access: { anyPermission: ['platform.billing'] } },
          ],
        },
      ],
    },
  ],
  footer: [
    {
      key: 'platform-help',
      label: 'Help',
      icon: <CircleQuestionMark />,
      href: '/platform/help',
    },
    {
      key: 'platform-settings',
      label: 'Settings',
      icon: <Settings />,
      href: '/platform/settings',
      access: { scope: 'platform', anyPermission: ['platform.security', 'platform.maintenance'] },
      panelHeader: { icon: <Settings />, title: 'Platform settings' },
      groups: [
        {
          key: 'platform-config',
          items: [
            { key: 'maintenance', label: 'Maintenance', icon: <Settings />, href: '/platform/settings/maintenance', access: { anyPermission: ['platform.maintenance'] } },
            { key: 'security-settings', label: 'Security', icon: <ShieldCheck />, href: '/platform/settings/security', access: { anyPermission: ['platform.security'] } },
          ],
        },
      ],
    },
  ],
};

/* ---- example viewer personas --------------------------------- */
const set = (keys: PermissionKey[]): ReadonlySet<PermissionKey> => new Set(keys);

export interface ViewerPersona {
  key: string;
  /** Short label for the preview persona switcher. */
  label: string;
  viewer: ViewerContext;
}

export const VIEWERS: ViewerPersona[] = [
  {
    key: 'registrar',
    label: 'Registrar · school',
    viewer: {
      clearanceLevel: 4,
      roles: ['Operations', 'Registrar'],
      scope: 'school',
      tenantId: 'sja',
      schoolType: 'secondary',
      permissions: set([
        'students.view',
        'students.view.detailed',
        'admissions.view',
        'attendance.view',
        'courses.view',
        'schedules.view',
        'subjects.view',
        'reports.view',
        'reports.academic',
        'settings.view',
      ]),
    },
  },
  {
    key: 'teacher',
    label: 'Teacher · school',
    viewer: {
      clearanceLevel: 3,
      roles: ['Teacher'],
      scope: 'school',
      tenantId: 'sja',
      schoolType: 'secondary',
      permissions: set([
        'students.view',
        'grades.view',
        'grades.edit.own_classes',
        'attendance.view',
        'attendance.edit.own_classes',
        'courses.view',
        'schedules.view',
        'subjects.view',
        'timetable.view',
        'transcripts.view',
      ]),
    },
  },
  {
    key: 'owner',
    label: 'Owner · school',
    viewer: {
      clearanceLevel: 8,
      roles: ['Owner'],
      scope: 'school',
      tenantId: 'sja',
      schoolType: 'secondary',
      permissions: set([
        'students.view',
        'students.view.detailed',
        'admissions.view',
        'attendance.view',
        'attendance.export',
        'courses.view',
        'schedules.view',
        'subjects.view',
        'grades.view',
        'transcripts.view',
        'fees.view',
        'billing.view',
        'payments.view',
        'financial_reports.view',
        'transportation.view',
        'timetable.view',
        'reports.view',
        'reports.academic',
        'reports.attendance',
        'analytics.view',
        'settings.view',
        'settings.school',
        'settings.theme',
        'settings.features',
        'settings.roles',
        'settings.users',
        'settings.audit',
      ]),
    },
  },
  {
    key: 'architect',
    label: 'Architect · platform',
    viewer: {
      clearanceLevel: 10,
      roles: ['Architect'],
      scope: 'platform',
      permissions: set([
        'platform.tenants',
        'platform.monitoring',
        'analytics.advanced',
        'platform.audit',
        'platform.support',
        'platform.billing',
        'platform.security',
        'platform.maintenance',
      ]),
    },
  },
];

/** The config that serves a given viewer's scope. */
export function configForViewer(viewer: ViewerContext): NavigationConfig {
  return viewer.scope === 'platform' ? PLATFORM_NAV : SCHOOL_NAV;
}
