/**
 * Retired route — Class enrolment merged into Student placement.
 *
 * Enrolment and lifecycle wrote the same fact (section membership) from two
 * screens; the lifecycle service is the authoritative writer, so it hosts both
 * as tabs. Kept as a redirect so existing links and bookmarks still land.
 */
import { redirect } from 'next/navigation';

export default function EnrollmentPage() {
  redirect('/academics/lifecycle');
}
