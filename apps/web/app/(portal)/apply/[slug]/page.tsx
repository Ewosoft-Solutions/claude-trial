/**
 * Public apply page for a school — `/apply/[slug]`. Server-fetches the school's
 * intake (cascade + published form) from the public API (no session), then
 * renders the branded apply form. A bad/inactive slug → 404.
 */
import { notFound } from 'next/navigation';
import { API_BASE } from '@/lib/api-client';
import { ApplyForm } from './apply-form';
import type { Intake } from '../../portal-types';

export const dynamic = 'force-dynamic';

async function getIntake(slug: string): Promise<Intake | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(
      `${API_BASE}/public/admissions/schools/${encodeURIComponent(slug)}/intake`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    return (await res.json()) as Intake;
  } catch {
    return null;
  }
}

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const intake = await getIntake(slug);
  if (!intake) notFound();
  return <ApplyForm slug={slug} intake={intake} />;
}
