'use client';

/* ============================================================
   /overview — persona-aware school dashboard

   Reads the ViewerContext (clearanceLevel + roles) and renders the
   dashboard variant appropriate to the signed-in persona.

   L7–L8  Owner / Management   → AdminDashboard   (school-wide KPIs)
   L6     ITSupport             → ITDashboard      (users, audit, settings)
   L5     Finance               → FinanceDashboard  (billing / collection)
   L4     Operations            → OperationsDashboard (transport, facilities)
   L3     Teacher               → TeacherDashboard  (classes, attendance, grades)
   L2     Parent                → ParentDashboard   (child overview, fees)
   L1     Student               → StudentDashboard  (schedule, grades)
   ============================================================ */

import { useViewer } from '@/app/providers/viewer-provider';
import { dashboardKindFor } from './dashboard-shape';
import { PlatformDashboard } from './dashboards/platform-dashboard';
import { AdminDashboard } from './dashboards/admin-dashboard';
import { FinanceDashboard } from './dashboards/finance-dashboard';
import { ITDashboard } from './dashboards/it-dashboard';
import { OperationsDashboard } from './dashboards/operations-dashboard';
import { ParentDashboard } from './dashboards/parent-dashboard';
import { StudentDashboard } from './dashboards/student-dashboard';
import { TeacherDashboard } from './dashboards/teacher-dashboard';

export default function OverviewPage() {
  const { viewer, user, schools, activeSchoolId } = useViewer();
  const schoolName =
    schools.find((s) => s.id === activeSchoolId)?.name ?? 'your school';
  const salutationName =
    user.firstName?.trim() || user.name.trim().split(/\s+/)[0] || user.name;

  // Routing lives in `dashboardKindFor` so the loading skeleton (which must
  // pick a shape BEFORE this renders) can resolve the same dashboard from the
  // session and cannot describe a different one. Custom per-profile
  // permissions may have stripped access to specific sections, but clearance
  // is the routing axis for the surface itself; the backend enforces the data.
  switch (dashboardKindFor(viewer.scope, viewer.clearanceLevel)) {
    case 'platform':
      return <PlatformDashboard userName={salutationName} />;
    case 'admin':
      return (
        <AdminDashboard userName={salutationName} schoolName={schoolName} />
      );
    case 'it':
      return <ITDashboard userName={salutationName} />;
    case 'finance':
      return (
        <FinanceDashboard userName={salutationName} schoolName={schoolName} />
      );
    case 'operations':
      return <OperationsDashboard userName={salutationName} />;
    case 'teacher':
      return <TeacherDashboard userName={salutationName} />;
    case 'parent':
      return (
        <ParentDashboard userName={salutationName} schoolName={schoolName} />
      );
    default:
      return <StudentDashboard userName={salutationName} />;
  }
}
