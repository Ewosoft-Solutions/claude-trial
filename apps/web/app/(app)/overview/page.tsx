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

  const { clearanceLevel } = viewer;

  // Scope is the primary axis, above clearance: a platform operator lands on the
  // platform overview, not a school dashboard. (A platform viewer has no active
  // school, so the school dashboards below would have nothing to render anyway.)
  if (viewer.scope === 'platform') {
    return <PlatformDashboard userName={user.name} />;
  }

  // Render per clearance level. Custom per-profile permissions may have
  // stripped access to specific sections — but clearance level is the
  // primary routing axis for the dashboard surface itself.
  // The backend enforces data access; this only selects the right UI.
  if (clearanceLevel >= 7) {
    return <AdminDashboard userName={user.name} schoolName={schoolName} />;
  }
  if (clearanceLevel === 6) {
    return <ITDashboard userName={user.name} />;
  }
  if (clearanceLevel === 5) {
    return <FinanceDashboard userName={user.name} schoolName={schoolName} />;
  }
  if (clearanceLevel === 4) {
    return <OperationsDashboard userName={user.name} />;
  }
  if (clearanceLevel === 3) {
    return <TeacherDashboard userName={user.name} />;
  }
  if (clearanceLevel === 2) {
    return <ParentDashboard userName={user.name} schoolName={schoolName} />;
  }
  // L0–L1: Student or Guest
  return <StudentDashboard userName={user.name} />;
}
