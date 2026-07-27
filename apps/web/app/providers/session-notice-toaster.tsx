'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
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
  const { resolvedTheme } = useTheme();

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

  return (
    <Toaster
      position="top-center"
      closeButton
      // Match the app surface (Aurora popover) instead of sonner's stock
      // palette; a tone-coloured left rail + icon carry the semantic meaning.
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      toastOptions={{
        classNames: {
          toast:
            'group relative overflow-hidden rounded-[var(--radius)] border border-border bg-popover text-popover-foreground shadow-lg backdrop-blur before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-[var(--toast-accent,transparent)] [&_[data-icon]]:text-[var(--toast-accent,var(--muted-foreground))]',
          title: 'text-[13px] font-semibold text-foreground',
          description: 'text-[12.5px] text-muted-foreground',
          actionButton:
            'rounded-[var(--radius-sm)] bg-primary text-primary-foreground',
          cancelButton:
            'rounded-[var(--radius-sm)] bg-muted text-muted-foreground',
          closeButton:
            'border-border bg-popover text-muted-foreground hover:text-foreground',
          success: '[--toast-accent:var(--success)]',
          warning: '[--toast-accent:var(--warning)]',
          error: '[--toast-accent:var(--destructive)]',
          info: '[--toast-accent:var(--info)]',
        },
      }}
    />
  );
}
