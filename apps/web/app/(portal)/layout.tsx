/**
 * Public applicant portal shell — the UNAUTHENTICATED surface (apply + status).
 * Deliberately outside the `(app)` shell: no nav, no session, just a clean
 * centered canvas a parent can use on a phone. The root layout still provides
 * html/body/theme/fonts.
 */
import * as React from 'react';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 sm:py-12">
        {children}
      </main>
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Powered by SchoolWithEase
      </footer>
    </div>
  );
}
