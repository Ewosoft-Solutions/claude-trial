/**
 * Consolidated into the unified "Application form" surface
 * (`/students/admissions/form`, Form fields tab). Kept as a redirect so existing
 * links / bookmarks continue to resolve.
 */
import { redirect } from 'next/navigation';

export default function AdmissionFormsPage() {
  redirect('/students/admissions/form');
}
