'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { toast, Toaster } from 'sonner';

export const SESSION_NOTICE_STORAGE_KEY = 'swe:session-notice:v1';
export const SESSION_NOTICE_TOAST_ID = 'idle-session-ended';

// The idle-logout notice belongs to the authenticated app only. It must never
// surface on the public applicant portal — a visitor with no account should not
// be told they were "signed out". Keep this in step with middleware's
// PUBLIC_PREFIXES.
const PUBLIC_PREFIXES = ['/apply/', '/status/'];

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
  const pathname = usePathname();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname?.startsWith(p));

  React.useEffect(() => {
    // Still render <Toaster/> for the portal's own toasts, but never raise the
    // authed-app idle notice on a public page.
    if (isPublic || !readNotice()) return;
    toast.warning('You were signed out after a period of inactivity.', {
      id: SESSION_NOTICE_TOAST_ID,
      duration: Infinity,
      closeButton: true,
      description: 'Sign in again to continue where you left off.',
      onDismiss: clearNotice,
    });
  }, [isPublic]);

  return (
    <Toaster
      position="top-center"
      closeButton
      offset={{ top: 12 }}
      mobileOffset={{ top: 12, right: 12, left: 12 }}
      style={{ '--width': '32rem' } as React.CSSProperties}
      // Soft tone-FILLED surface (a wash of the semantic colour over the app
      // popover) + tone border + tone icon — reads as the app's own warning /
      // success / error styling rather than sonner's stock palette, and adapts
      // to light and dark. `--toast-accent` is set per type below.
      theme={resolvedTheme === 'light' ? 'light' : 'dark'}
      toastOptions={{
        // Sonner injects its own surface styles at runtime. Inline token
        // expressions are the reliable override boundary for those colours;
        // the semantic class below supplies `--toast-accent` per toast type.
        style: {
          // Fill, border and ink each derive from the tone accent by default,
          // but a tone can override any one independently: the warning tone
          // (below) uses a brighter golden --warning-wash for the fill/border
          // while keeping a dark --warning-ink for the text, so it warms up
          // without the message going pale.
          '--toast-ink':
            'color-mix(in oklab, var(--toast-ink-accent, var(--toast-accent, var(--foreground))) 72%, var(--foreground))',
          background:
            'color-mix(in oklab, var(--toast-fill-accent, var(--toast-accent, var(--muted))) var(--toast-fill-pct, 16%), var(--background))',
          borderColor:
            'color-mix(in oklab, var(--toast-border-accent, var(--toast-accent, var(--border))) 52%, var(--border))',
          color: 'var(--toast-ink)',
        } as React.CSSProperties,
        classNames: {
          toast:
            'group rounded-[var(--radius)] border shadow-lg backdrop-blur [&_[data-icon]]:text-[var(--toast-accent,var(--muted-foreground))]',
          title:
            'text-[calc(13px*var(--font-scale))] font-semibold text-[var(--toast-ink)]',
          description:
            'text-[calc(12.5px*var(--font-scale))] text-[var(--toast-ink)] opacity-80',
          actionButton:
            'rounded-[var(--radius-sm)] bg-primary-surface text-primary-surface-foreground',
          cancelButton:
            'rounded-[var(--radius-sm)] bg-muted text-muted-foreground',
          closeButton:
            '!absolute !top-1/2 !right-3 !left-auto !size-7 !translate-x-0 !-translate-y-1/2 !rounded-[var(--radius-sm)] !border-0 !bg-transparent text-[var(--toast-ink)] opacity-75 hover:!bg-foreground/5 hover:opacity-100',
          success: '[--toast-accent:var(--success)]',
          // Amber icon (--warning) + brighter golden fill/border (--warning-wash)
          // + dark text (--warning-ink). Light-only: in dark, all three tokens
          // collapse back to the existing bright warning treatment.
          warning:
            '[--toast-accent:var(--warning)] [--toast-fill-accent:var(--warning-wash)] [--toast-border-accent:var(--warning-wash)] [--toast-fill-pct:var(--warning-wash-pct)] [--toast-ink-accent:var(--warning-ink)]',
          error: '[--toast-accent:var(--destructive)]',
          info: '[--toast-accent:var(--info)]',
        },
      }}
    />
  );
}
