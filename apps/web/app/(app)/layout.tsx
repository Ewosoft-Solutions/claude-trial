/* ============================================================
   (app) — authenticated route group layout

   Mounts the session seam (ViewerProvider) and the application
   chrome (AppChrome). Every route under `(app)` renders inside the
   Aurora shell with role/tenant-aware navigation driven by the real
   ViewerContext + Next router. Route groups add no path segment, so
   children map to `/overview`, `/students/...`, etc.
   ============================================================ */

import { ViewerProvider } from '@/app/providers/viewer-provider';
import { AppChrome } from './app-chrome';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ViewerProvider>
      <AppChrome>{children}</AppChrome>
    </ViewerProvider>
  );
}
