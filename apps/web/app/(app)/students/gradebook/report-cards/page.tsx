/**
 * Retired route — Report cards merged into Gradebook standing.
 *
 * Both read the same two endpoints and averaged the same numbers; the standing
 * view carries the letter-grade column that was unique to this page. Official
 * report cards are published artifacts under /academics/results.
 */
import { redirect } from 'next/navigation';

export default function ReportCardsPage() {
  redirect('/students/gradebook/standing');
}
