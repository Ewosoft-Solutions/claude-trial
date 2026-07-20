'use client';

import * as React from 'react';
import { toast, Toaster } from 'sonner';

export const SESSION_NOTICE_STORAGE_KEY = 'swe:session-notice:v1';

interface SessionNotice {
  version: 1;
  kind: 'idle';
  at: number;
}

function readNotice(): SessionNotice | null {
  try {
    const raw = localStorage.getItem(SESSION_NOTICE_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SessionNotice>;
    return value.version === 1 &&
      value.kind === 'idle' &&
      typeof value.at === 'number'
      ? (value as SessionNotice)
      : null;
  } catch {
    return null;
  }
}

function clearNotice() {
  try {
    localStorage.removeItem(SESSION_NOTICE_STORAGE_KEY);
  } catch {
    // Storage may be disabled; the toast can still be dismissed in memory.
  }
}

export function SessionNoticeToaster() {
  React.useEffect(() => {
    if (!readNotice()) return;
    toast.warning('You were signed out after a period of inactivity.', {
      id: 'idle-session-ended',
      duration: Infinity,
      closeButton: true,
      description: 'Sign in again to continue where you left off.',
      onDismiss: clearNotice,
    });
  }, []);

  return <Toaster position="top-center" closeButton richColors />;
}
