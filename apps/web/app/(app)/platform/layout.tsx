/* ============================================================
   /platform — route-group guard

   Everything under /platform is the Architect's cross-tenant console. The nav
   already only surfaces these routes to a platform-scoped viewer
   (`viewer.scope === 'platform'`), but that alone doesn't stop a school-scoped
   user from reaching a platform page by typing the URL — the page shell would
   render (empty, with the data APIs 403ing). This layout closes that gap: a
   non-platform viewer is redirected to /unauthorized before any platform page
   renders. Individual pages/APIs still enforce their own finer permission.
   ============================================================ */

import { requireScope } from '@/lib/access';

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireScope('platform');
  return <>{children}</>;
}
