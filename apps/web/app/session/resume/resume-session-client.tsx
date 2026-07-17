'use client';

import * as React from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';

export const RESUMED_MODAL_STORAGE_KEY = 'swe:resume-modal:v1';

interface ResumeResponse {
  target: string;
  modalKey?: string;
  restored: boolean;
}

async function consumeResume(): Promise<ResumeResponse | null> {
  const response = await fetch('/api/auth/resume', {
    method: 'POST',
    cache: 'no-store',
  });
  return response.ok ? ((await response.json()) as ResumeResponse) : null;
}

export function ResumeSessionClient() {
  const [message, setMessage] = React.useState('Restoring your session…');

  React.useEffect(() => {
    let cancelled = false;
    async function resume() {
      let result = await consumeResume();
      if (!result) {
        setMessage('Checking your secure session…');
        const refreshed = await fetch('/api/auth/refresh', {
          method: 'POST',
          cache: 'no-store',
        });
        if (refreshed.ok) result = await consumeResume();
      }

      if (cancelled) return;
      if (!result) {
        window.location.replace('/login');
        return;
      }
      if (result.modalKey) {
        try {
          sessionStorage.setItem(RESUMED_MODAL_STORAGE_KEY, result.modalKey);
        } catch {
          // Storage can be unavailable in private browsing; route restore still works.
        }
      }
      window.location.replace(result.target);
    }
    void resume();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="grid min-h-svh place-items-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="relative grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-7" aria-hidden />
          <LoaderCircle
            className="absolute -inset-1 size-[4.5rem] animate-spin text-primary/35 motion-reduce:animate-none"
            aria-hidden
          />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Returning you safely
          </h1>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {message}
          </p>
        </div>
      </div>
    </main>
  );
}
