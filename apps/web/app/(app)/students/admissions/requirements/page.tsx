/**
 * Consolidated into the unified "Application form" surface
 * (`/students/admissions/form`, Documents & fees tab). Kept as a redirect so
 * existing links / bookmarks continue to resolve.
 */
import { redirect } from 'next/navigation';

export default function AdmissionRequirementsPage() {
  redirect('/students/admissions/form?tab=requirements');
}
