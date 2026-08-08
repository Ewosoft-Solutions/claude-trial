'use client';

import * as React from 'react';
import { LoaderCircle, ShieldCheck } from 'lucide-react';

import {
  ACTIVITY_STORAGE_KEY,
  evaluateSessionLifecycle,
  readStoredActivity,
  readStoredPolicy,
} from '@/lib/session-lifecycle';
import { SESSION_NOTICE_STORAGE_KEY } from '@/app/providers/session-notice-toaster';

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

/**
 * Has the user been idle past the logout deadline? Evaluated from the persisted
 * activity timestamp + policy snapshot BEFORE we re-authenticate, so an
 * idle-expired user is signed out cleanly instead of being resumed into the app
 * and then ejected a beat later. Returns false when there's no history to judge
 * (first use / cleared storage), degrading to the normal resume.
 */
function isIdleExpired(): boolean {
  const lastActivityAt = readStoredActivity();
  const policy = readStoredPolicy();
  if (lastActivityAt == null || !policy) return false;
  const decision = evaluateSessionLifecycle({
    now: Date.now(),
    lastActivityAt,
    focusMode: false,
    policy,
  });
  return decision.type === 'idle-logout';
}

/** Sign out an idle-expired user: leave the inactivity notice for the login
 *  screen, clear the auth cookies (the resume cookie for the original target,
 *  set by middleware, is preserved via `skipResumeState`), then go to login. */
async function signOutIdle() {
  try {
    localStorage.setItem(
      SESSION_NOTICE_STORAGE_KEY,
      JSON.stringify({ version: 1, kind: 'idle', at: Date.now() }),
    );
    localStorage.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    // Storage may be disabled; the sign-out still proceeds.
  }
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'idle', skipResumeState: true }),
    });
  } catch {
    // Best-effort revoke; cookies are cleared server-side and login replaces them.
  }
  window.location.replace('/login');
}

export function ResumeSessionClient() {
  const [message, setMessage] = React.useState('Restoring your session…');

  React.useEffect(() => {
    let cancelled = false;
    async function resume() {
      // Decide BEFORE re-authenticating: a user who was away past the idle
      // deadline must not be resumed into the app first.
      if (isIdleExpired()) {
        setMessage('Signing you out…');
        await signOutIdle();
        return;
      }

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
