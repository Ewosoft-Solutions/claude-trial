'use client';

/* ============================================================
   (app)/[...slug] — placeholder for not-yet-built surfaces

   The navigation model offers many destinations that don't have a
   real page yet (Phase 3+). Rather than 404, those routes land here
   inside the shell and render the shared M5 EmptyState, so the whole
   role/tenant-aware nav stays explorable. More specific routes (e.g.
   /overview) take precedence over this catch-all.
   ============================================================ */

import { usePathname } from 'next/navigation';
import { Hammer } from 'lucide-react';

import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { EmptyState } from '@workspace/ui/custom/states/page-states';

/** Title-case the last path segment for a human-readable heading. */
function labelFromPath(pathname: string): string {
  const last = pathname.split('/').filter(Boolean).pop() ?? 'This area';
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PlaceholderPage() {
  const pathname = usePathname();

  return (
    <ShellMain className="justify-center">
      <EmptyState
        icon={<Hammer aria-hidden />}
        tone="info"
        title={`${labelFromPath(pathname)} isn't built yet`}
        description="This destination is part of the role-aware navigation but its screen lands in a later phase. The shell, routing, and access filtering are live — pick another destination from the sidebar."
        primaryAction={{ label: 'Back to dashboard', href: '/overview' }}
        footer={
          <code className="rounded bg-muted px-1.5 py-0.5">{pathname}</code>
        }
      />
    </ShellMain>
  );
}
