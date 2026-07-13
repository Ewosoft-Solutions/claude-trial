/* ============================================================
   SchoolWithEase — application navigation configuration

   The real (non-preview) navigation surfaces for the product,
   consumed by the authenticated shell layout. Nodes carry access
   guards (clearance / permission / scope / school type) drawn from
   requirements/access-control.md + permissions.md; `resolveNavigation`
   (@workspace/ui/lib/navigation) filters a config for the signed-in
   ViewerContext and derives active state from the route. The shell
   components themselves carry no roles or tenant logic.

   Routes here map to app routes under the `(app)` route group
   (route groups add no path segment), e.g. `/overview`,
   `/students/enrollment`.
   ============================================================ */

import {
  Banknote,
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  CalendarDays,
  ChartColumn,
  CircleQuestionMark,
  Contact,
  CreditCard,
  FileText,
  GraduationCap,
  HeartPulse,
  House,
  LifeBuoy,
  PartyPopper,
  ScrollText,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

import type { ViewerContext } from '@workspace/ui/types/access.types';
import type { NavigationConfig } from '@workspace/ui/types/navigation.types';

/* ---- school-level navigation --------------------------------- */
export const SCHOOL_NAV: NavigationConfig = {
  scope: 'school',
  sections: [
    {
      key: 'overview',
      label: 'Overview',
      icon: <House />,
      href: '/overview',
      access: { minClearance: 1 },
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
              access: { anyPermission: ['admissions.view'] },
            },
            {
              key: 'directory',
              label: 'Directory',
              icon: <Contact />,
              href: '/students/directory',
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
              access: { anyPermission: ['fees.view'] },
            },
            {
              key: 'transport',
              label: 'Transport',
              icon: <Bus />,
              href: '/students/transport',
              access: {
                anyPermission: ['transportation.view'],
                schoolTypes: ['nursery', 'primary', 'secondary'],
              },
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
      access: {
        anyPermission: [
          'courses.view',
          'schedules.view',
          'lessons.view.own',
          'assessments.take',
        ],
      },
      panelHeader: { icon: <BookOpen />, title: 'Classes' },
      groups: [
        {
          key: 'teaching',
          label: 'Teaching',
          items: [
            {
              key: 'timetable',
              label: 'Timetable',
              icon: <CalendarDays />,
              href: '/classes/timetable',
              access: { anyPermission: ['timetable.view'] },
            },
            {
              key: 'gradebook',
              label: 'Gradebook',
              icon: <BookOpen />,
              href: '/classes/gradebook',
              access: { anyPermission: ['grades.view'] },
            },
            {
              key: 'subjects',
              label: 'Subjects',
              icon: <GraduationCap />,
              href: '/classes/subjects',
              access: { anyPermission: ['subjects.view', 'courses.view'] },
            },
            {
              key: 'materials',
              label: 'Materials',
              icon: <FileText />,
              href: '/classes/materials',
              access: { anyPermission: ['lessons.view', 'lessons.view.own'] },
            },
            {
              key: 'assessments',
              label: 'Assessments',
              icon: <ScrollText />,
              href: '/classes/assessments',
              access: { anyPermission: ['assessments.view'] },
            },
            {
              key: 'take-assessments',
              label: 'Take assessments',
              icon: <ScrollText />,
              href: '/classes/assessments/take',
              access: { anyPermission: ['assessments.take'] },
            },
            {
              key: 'question-bank',
              label: 'Question bank',
              icon: <FileText />,
              href: '/classes/question-bank',
              access: { anyPermission: ['questions.view'] },
            },
            {
              key: 'academic-review',
              label: 'Review queue',
              icon: <ShieldCheck />,
              href: '/classes/review',
              access: { anyPermission: ['lessons.approve'] },
            },
            {
              key: 'teacher-allocation',
              label: 'Teacher allocation',
              icon: <Users />,
              href: '/classes/teachers',
              access: { anyPermission: ['classes.teachers.assign'] },
            },
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
            {
              key: 'daily',
              label: 'Daily register',
              icon: <CalendarDays />,
              href: '/attendance/daily',
              access: { anyPermission: ['attendance.view'] },
            },
            {
              key: 'reports',
              label: 'Reports',
              icon: <ChartColumn />,
              href: '/attendance/reports',
              access: {
                anyPermission: ['attendance.export', 'reports.attendance'],
              },
            },
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
      access: {
        minClearance: 5,
        anyPermission: ['fees.view', 'financial_reports.view'],
      },
      panelHeader: { icon: <Wallet />, title: 'Finance' },
      groups: [
        {
          key: 'money',
          label: 'Billing',
          items: [
            {
              key: 'invoices',
              label: 'Invoices',
              icon: <CreditCard />,
              href: '/finance/invoices',
              access: { anyPermission: ['billing.view', 'payments.view'] },
            },
            {
              key: 'payments',
              label: 'Payments',
              icon: <Banknote />,
              href: '/finance/payments',
              access: { anyPermission: ['payments.view'] },
            },
            {
              key: 'fin-reports',
              label: 'Reports',
              icon: <ChartColumn />,
              href: '/finance/reports',
              access: { anyPermission: ['financial_reports.view'] },
            },
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
            {
              key: 'academic',
              label: 'Academic',
              icon: <GraduationCap />,
              href: '/reports/academic',
              access: { anyPermission: ['reports.academic', 'reports.view'] },
            },
            {
              key: 'analytics',
              label: 'Analytics',
              icon: <ChartColumn />,
              href: '/reports/analytics',
              access: { anyPermission: ['analytics.view'] },
            },
          ],
        },
      ],
    },
    {
      key: 'transport',
      label: 'Transport',
      icon: <Bus />,
      href: '/transport',
      // Transport is only relevant for schools that physically move students.
      access: {
        anyPermission: ['transportation.view'],
        schoolTypes: ['nursery', 'primary', 'secondary'],
        features: ['transport'],
      },
      panelHeader: { icon: <Bus />, title: 'Transport' },
      groups: [
        {
          key: 'routes',
          label: 'Routes',
          items: [
            {
              key: 'routes-list',
              label: 'Routes',
              icon: <Bus />,
              href: '/transport/routes',
              access: { anyPermission: ['transportation.view'] },
            },
            {
              key: 'pickups',
              label: 'Pickups & drops',
              icon: <Contact />,
              href: '/transport/pickups',
              access: { anyPermission: ['transportation.view'] },
            },
          ],
        },
      ],
    },
    {
      key: 'library',
      label: 'Library',
      icon: <BookMarked />,
      href: '/library',
      // Library management is relevant for primary schools and above.
      access: {
        anyPermission: ['library.view'],
        schoolTypes: ['primary', 'secondary', 'university', 'college'],
        features: ['library'],
      },
      panelHeader: { icon: <BookMarked />, title: 'Library' },
      groups: [
        {
          key: 'catalog',
          label: 'Catalog',
          items: [
            {
              key: 'books',
              label: 'Books',
              icon: <BookMarked />,
              href: '/library/books',
              access: { anyPermission: ['library.view'] },
            },
            {
              key: 'loans',
              label: 'Loans',
              icon: <ScrollText />,
              href: '/library/loans',
              access: { anyPermission: ['library.view'] },
            },
          ],
        },
      ],
    },
    {
      key: 'hr',
      label: 'HR',
      icon: <Briefcase />,
      href: '/hr',
      // HR/staff management is relevant for secondary schools and above.
      access: {
        anyPermission: ['hr.view'],
        schoolTypes: [
          'secondary',
          'university',
          'college',
          'training_institute',
          'organization',
        ],
      },
      panelHeader: { icon: <Briefcase />, title: 'Human Resources' },
      groups: [
        {
          key: 'staff',
          label: 'Staff',
          items: [
            {
              key: 'staff-directory',
              label: 'Directory',
              icon: <Users />,
              href: '/hr/directory',
              access: { anyPermission: ['hr.view'] },
            },
            {
              key: 'staff-leave',
              label: 'Leave',
              icon: <CalendarDays />,
              href: '/hr/leave',
              access: { anyPermission: ['hr.view'] },
            },
            {
              key: 'staff-payroll',
              label: 'Payroll',
              icon: <Wallet />,
              href: '/hr/payroll',
              access: { anyPermission: ['payroll.view'] },
            },
          ],
        },
      ],
    },
    {
      key: 'health',
      label: 'Health',
      icon: <HeartPulse />,
      href: '/health',
      access: { anyPermission: ['health.view'], features: ['health'] },
      panelHeader: { icon: <HeartPulse />, title: 'Health' },
      groups: [
        {
          key: 'medical',
          label: 'Medical',
          items: [
            {
              key: 'health-records',
              label: 'Records',
              icon: <HeartPulse />,
              href: '/health/records',
              access: { anyPermission: ['health.view'] },
            },
          ],
        },
      ],
    },
    {
      key: 'events',
      label: 'Events',
      icon: <PartyPopper />,
      href: '/events',
      access: { anyPermission: ['events.view'] },
      panelHeader: { icon: <PartyPopper />, title: 'Events' },
      groups: [
        {
          key: 'calendar',
          label: 'Calendar',
          items: [
            {
              key: 'events-upcoming',
              label: 'Upcoming',
              icon: <PartyPopper />,
              href: '/events/upcoming',
              access: { anyPermission: ['events.view'] },
            },
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
      access: {
        anyPermission: ['settings.view', 'settings.school', 'ai.configure'],
      },
      // No `groups`: the dedicated settings route group
      // (app/(app)/settings/layout.tsx) renders its own in-panel SettingsNav,
      // so listing the sub-sections here would only duplicate that panel in the
      // shell. Settings is a rail-only footer link (like Help). `panelHeader` is
      // kept because the breadcrumb still derives its section title from it.
      panelHeader: { icon: <Settings />, title: 'Settings' },
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
            {
              key: 'all-schools',
              label: 'All schools',
              icon: <Building2 />,
              href: '/platform/tenants/all',
              access: { anyPermission: ['platform.tenants'] },
            },
            {
              key: 'onboarding',
              label: 'Onboarding',
              icon: <UserPlus />,
              href: '/platform/tenants/onboarding',
              access: { anyPermission: ['platform.tenants'] },
            },
          ],
        },
      ],
    },
    {
      key: 'analytics',
      label: 'Analytics',
      icon: <ChartColumn />,
      href: '/platform/analytics',
      access: {
        scope: 'platform',
        anyPermission: ['platform.monitoring', 'analytics.advanced'],
      },
      panelHeader: { icon: <ChartColumn />, title: 'Platform analytics' },
      groups: [
        {
          key: 'health',
          items: [
            {
              key: 'usage',
              label: 'Usage',
              icon: <ChartColumn />,
              href: '/platform/analytics/usage',
              access: {
                anyPermission: ['platform.monitoring', 'analytics.advanced'],
              },
            },
            {
              key: 'performance',
              label: 'Performance',
              icon: <ChartColumn />,
              href: '/platform/analytics/performance',
              access: { anyPermission: ['platform.monitoring'] },
            },
          ],
        },
      ],
    },
    {
      key: 'audit',
      label: 'Audit',
      icon: <ShieldCheck />,
      href: '/platform/audit',
      access: {
        scope: 'platform',
        anyPermission: ['platform.audit', 'platform.audit.limited'],
      },
      panelHeader: { icon: <ShieldCheck />, title: 'Audit & security' },
      groups: [
        {
          key: 'trail',
          items: [
            {
              key: 'audit-log',
              label: 'Audit log',
              icon: <ScrollText />,
              href: '/platform/audit/log',
              access: {
                anyPermission: ['platform.audit', 'platform.audit.limited'],
              },
            },
            {
              key: 'security',
              label: 'Security',
              icon: <ShieldCheck />,
              href: '/platform/audit/security',
              access: { anyPermission: ['platform.security'] },
            },
          ],
        },
      ],
    },
    {
      key: 'support',
      label: 'Support',
      icon: <LifeBuoy />,
      href: '/platform/support',
      access: {
        scope: 'platform',
        anyPermission: ['platform.support', 'platform.support.access'],
      },
      panelHeader: { icon: <LifeBuoy />, title: 'Support' },
      groups: [
        {
          key: 'tickets',
          items: [
            {
              key: 'queue',
              label: 'Ticket queue',
              icon: <LifeBuoy />,
              href: '/platform/support/queue',
              access: {
                anyPermission: ['platform.support', 'platform.support.access'],
              },
            },
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
            {
              key: 'plans',
              label: 'Plans',
              icon: <CreditCard />,
              href: '/platform/billing/plans',
              access: { anyPermission: ['platform.billing'] },
            },
            {
              key: 'invoices',
              label: 'Invoices',
              icon: <Banknote />,
              href: '/platform/billing/invoices',
              access: { anyPermission: ['platform.billing'] },
            },
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
      access: {
        scope: 'platform',
        anyPermission: ['platform.security', 'platform.maintenance'],
      },
      panelHeader: { icon: <Settings />, title: 'Platform settings' },
      groups: [
        {
          key: 'platform-config',
          items: [
            {
              key: 'maintenance',
              label: 'Maintenance',
              icon: <Settings />,
              href: '/platform/settings/maintenance',
              access: { anyPermission: ['platform.maintenance'] },
            },
            {
              key: 'security-settings',
              label: 'Security',
              icon: <ShieldCheck />,
              href: '/platform/settings/security',
              access: { anyPermission: ['platform.security'] },
            },
          ],
        },
      ],
    },
  ],
};

/** The navigation config that serves a given viewer's active scope. */
export function configForViewer(viewer: ViewerContext): NavigationConfig {
  return viewer.scope === 'platform' ? PLATFORM_NAV : SCHOOL_NAV;
}
