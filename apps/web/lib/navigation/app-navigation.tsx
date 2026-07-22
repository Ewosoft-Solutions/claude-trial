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
  ClipboardCheck,
  Contact,
  CreditCard,
  FileText,
  GraduationCap,
  HeartPulse,
  House,
  Palette,
  PartyPopper,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  ToggleRight,
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
    {
      key: 'settings',
      label: 'School settings',
      icon: <Settings />,
      href: '/settings/general',
      access: {
        anyPermission: [
          'settings.view',
          'settings.school',
          'settings.security',
          'ai.configure',
          'roles.view',
          'users.view',
          'settings.audit',
        ],
      },
      panelHeader: { icon: <Settings />, title: 'School settings' },
      groups: [
        {
          key: 'school-configuration',
          label: 'School',
          items: [
            {
              key: 'settings-general',
              label: 'General',
              icon: <Settings />,
              href: '/settings/general',
              access: {
                anyPermission: ['settings.view', 'settings.school'],
              },
            },
            {
              key: 'settings-branding',
              label: 'Branding',
              icon: <Palette />,
              href: '/settings/branding',
              access: {
                anyPermission: ['settings.view', 'settings.school'],
              },
            },
            {
              key: 'settings-features',
              label: 'Features',
              icon: <ToggleRight />,
              href: '/settings/features',
              access: {
                anyPermission: ['settings.view', 'settings.school'],
              },
            },
            {
              key: 'settings-security',
              label: 'Security',
              icon: <ShieldCheck />,
              href: '/settings/security',
              access: {
                anyPermission: ['settings.view', 'settings.security'],
              },
            },
          ],
        },
        {
          key: 'school-administration',
          label: 'Administration',
          items: [
            {
              key: 'settings-ai',
              label: 'AI usage',
              icon: <Sparkles />,
              href: '/settings/ai-usage',
              access: { anyPermission: ['ai.configure'] },
            },
            {
              key: 'settings-roles',
              label: 'Roles & permissions',
              icon: <ShieldCheck />,
              href: '/settings/roles',
              access: { anyPermission: ['roles.view'] },
            },
            {
              key: 'settings-users',
              label: 'Users',
              icon: <Users />,
              href: '/settings/users',
              access: { anyPermission: ['users.view'] },
            },
            {
              key: 'settings-audit',
              label: 'Audit log',
              icon: <ScrollText />,
              href: '/settings/audit',
              access: { anyPermission: ['settings.audit'] },
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
      access: { scope: 'platform', anyPermission: ['platform.tenants.read'] },
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
              access: { anyPermission: ['platform.tenants.read'] },
            },
            {
              key: 'onboarding',
              label: 'Onboarding',
              icon: <UserPlus />,
              href: '/platform/tenants/onboarding',
              access: { anyPermission: ['platform.tenants.act'] },
            },
            {
              key: 'approvals',
              label: 'Approvals',
              icon: <ClipboardCheck />,
              href: '/platform/tenants/approvals',
              access: { anyPermission: ['platform.tenants.act'] },
            },
          ],
        },
      ],
    },
    // Analytics re-added in Phase 3 (its pages are now real). Support and
    // Billing remain removed (no backend — docs/platform-scope-plan.md §5, 2.4);
    // re-add each when its pages land.
    {
      key: 'analytics',
      label: 'Analytics',
      icon: <ChartColumn />,
      href: '/platform/analytics',
      access: { scope: 'platform', anyPermission: ['platform.metrics'] },
      panelHeader: { icon: <ChartColumn />, title: 'Analytics' },
      groups: [
        {
          key: 'insight',
          items: [
            {
              key: 'analytics-overview',
              label: 'Overview',
              icon: <ChartColumn />,
              href: '/platform/analytics',
              access: { anyPermission: ['platform.metrics'] },
            },
            {
              key: 'assistant',
              label: 'AI assistant',
              icon: <Sparkles />,
              href: '/platform/analytics/assistant',
              access: { anyPermission: ['platform.metrics'] },
            },
          ],
        },
      ],
    },
    // Audit re-added in 2.1 — its page is now real. Support and Billing remain
    // removed (Phase 2/3 features); re-add each when its pages land.
    {
      key: 'audit',
      label: 'Audit',
      icon: <ScrollText />,
      href: '/platform/audit/log',
      access: {
        scope: 'platform',
        anyPermission: ['platform.audit', 'platform.audit.limited'],
      },
      panelHeader: { icon: <ScrollText />, title: 'Audit' },
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
          ],
        },
      ],
    },
  ],
  footer: [
    // Help (/platform/help) and the Maintenance settings item were removed (1.4)
    // as dead links. The Settings entry now points straight at the one platform
    // settings page that exists — security governance.
    {
      key: 'platform-settings',
      label: 'Settings',
      icon: <Settings />,
      href: '/platform/settings/security',
      access: {
        scope: 'platform',
        anyPermission: ['platform.security'],
      },
      panelHeader: { icon: <Settings />, title: 'Platform settings' },
      groups: [
        {
          key: 'platform-config',
          items: [
            {
              key: 'security-settings',
              label: 'Security',
              icon: <ShieldCheck />,
              href: '/platform/settings/security',
              access: { anyPermission: ['platform.security'] },
            },
            {
              key: 'policy-posture',
              label: 'Policy posture',
              icon: <ShieldCheck />,
              href: '/platform/settings/policies',
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
