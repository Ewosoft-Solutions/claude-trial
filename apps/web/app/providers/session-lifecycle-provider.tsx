'use client';

import * as React from 'react';
import { Clock3, ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';

import { refreshBrowserSession } from '@/lib/authed-fetch';
import type { ResumableModalKey } from '@/lib/resume-state';
import type { Session } from '@/lib/session';
import {
  ACTIVITY_STORAGE_KEY,
  evaluateSessionLifecycle,
} from '@/lib/session-lifecycle';
import { RESUMED_MODAL_STORAGE_KEY } from '@/app/session/resume/resume-session-client';
import { SESSION_NOTICE_STORAGE_KEY } from './session-notice-toaster';

const CHANNEL_NAME = 'swe:session-lifecycle:v1';
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;
const ACCESS_REFRESH_LEAD_MS = 5 * 60 * 1000;

type LogoutReason = 'manual' | 'idle' | 'absolute_expiry' | 'refresh_failed';
type FocusKind = 'assessment' | 'assignment' | 'reading' | 'media';

interface WarningState {
  deadline: number;
  durationSeconds: number;
  focus: boolean;
}

interface ModalRegistration {
  open: boolean;
  reopen: () => void;
}

interface SessionLifecycleContextValue {
  registerFocusMode: (
    key: string,
    kind: FocusKind,
    active: boolean,
  ) => () => void;
  registerResumableModal: (
    key: ResumableModalKey,
    registration: ModalRegistration,
  ) => () => void;
  signOut: () => Promise<void>;
  reportActivity: () => void;
}

const SessionLifecycleContext =
  React.createContext<SessionLifecycleContextValue | null>(null);

function safelyWrite(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Safari private browsing and restricted webviews can disable storage.
  }
}

function safelyRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Best effort only.
  }
}

function readStoredActivity(): number | null {
  try {
    const value = Number(localStorage.getItem(ACTIVITY_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function readPendingModal(): string | null {
  try {
    return sessionStorage.getItem(RESUMED_MODAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearPendingModal() {
  try {
    sessionStorage.removeItem(RESUMED_MODAL_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function SessionLifecycleProvider({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const lastActivityRef = React.useRef(Date.now());
  const lastPersistedActivityRef = React.useRef(0);
  const accessExpiresAtRef = React.useRef(session.accessExpiresAt);
  const focusModesRef = React.useRef(new Map<string, FocusKind>());
  const modalsRef = React.useRef(
    new Map<ResumableModalKey, ModalRegistration>(),
  );
  const channelRef = React.useRef<BroadcastChannel | null>(null);
  const loggingOutRef = React.useRef(false);
  const refreshingRef = React.useRef(false);
  const [warning, setWarning] = React.useState<WarningState | null>(null);
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);
  const [warningError, setWarningError] = React.useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = React.useTransition();

  const persistActivity = React.useCallback((at: number, broadcast = true) => {
    if (at - lastPersistedActivityRef.current < ACTIVITY_WRITE_THROTTLE_MS) {
      return;
    }
    lastPersistedActivityRef.current = at;
    safelyWrite(ACTIVITY_STORAGE_KEY, String(at));
    if (broadcast) channelRef.current?.postMessage({ type: 'activity', at });
  }, []);

  const markActivity = React.useCallback(
    (at = Date.now(), broadcast = true) => {
      if (at <= lastActivityRef.current) return;
      lastActivityRef.current = at;
      persistActivity(at, broadcast);
    },
    [persistActivity],
  );

  const recordUserActivity = React.useCallback(() => {
    const now = Date.now();
    const idleThreshold = session.sessionPolicy.idleTimeoutMinutes * 60 * 1000;
    // The first tap after a suspended PWA wakes must not silently erase a
    // completed idle period before the timestamp evaluator observes it.
    if (now - lastActivityRef.current >= idleThreshold) return;
    markActivity(now);
  }, [markActivity, session.sessionPolicy.idleTimeoutMinutes]);

  const performLogout = React.useCallback(
    async (reason: LogoutReason, fromAnotherTab = false) => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      const modalKey = [...modalsRef.current.entries()].find(
        ([, registration]) => registration.open,
      )?.[0];

      if (reason === 'idle') {
        safelyWrite(
          SESSION_NOTICE_STORAGE_KEY,
          JSON.stringify({ version: 1, kind: 'idle', at: Date.now() }),
        );
      }
      safelyRemove(ACTIVITY_STORAGE_KEY);
      if (!fromAnotherTab) {
        channelRef.current?.postMessage({ type: 'logout', reason });
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason,
              tenantId: session.defaultSchoolId,
              profileId: session.activeProfileId,
              modalKey,
            }),
          });
        } catch {
          // Cookie clearing is best-effort when offline; failed refresh will
          // still prevent protected API access and login will replace cookies.
        }
      }
      window.location.replace('/login');
    },
    [session.activeProfileId, session.defaultSchoolId],
  );

  const maybeRefresh = React.useCallback(async () => {
    if (
      refreshingRef.current ||
      document.visibilityState === 'hidden' ||
      !navigator.onLine ||
      Date.now() < accessExpiresAtRef.current - ACCESS_REFRESH_LEAD_MS
    ) {
      return;
    }
    refreshingRef.current = true;
    const result = await refreshBrowserSession();
    refreshingRef.current = false;
    if (result.success && result.accessExpiresAt) {
      accessExpiresAtRef.current = result.accessExpiresAt;
      channelRef.current?.postMessage({
        type: 'refreshed',
        accessExpiresAt: result.accessExpiresAt,
      });
    } else if (result.failure === 'unauthorized') {
      await performLogout('refresh_failed');
    }
  }, [performLogout]);

  React.useEffect(() => {
    const now = Date.now();
    const storedActivity = readStoredActivity();
    lastActivityRef.current = storedActivity ?? now;
    lastPersistedActivityRef.current = storedActivity ?? 0;
    if (
      !storedActivity ||
      now - storedActivity <
        session.sessionPolicy.idleTimeoutMinutes * 60 * 1000
    ) {
      markActivity(now);
    }

    const channel =
      typeof BroadcastChannel === 'function'
        ? new BroadcastChannel(CHANNEL_NAME)
        : null;
    channelRef.current = channel;
    if (channel) {
      channel.onmessage = (event: MessageEvent) => {
        const message = event.data as {
          type?: string;
          at?: number;
          accessExpiresAt?: number;
          reason?: LogoutReason;
        };
        if (message.type === 'activity' && typeof message.at === 'number') {
          markActivity(message.at, false);
          setWarning(null);
          setWarningError(null);
        } else if (
          message.type === 'refreshed' &&
          typeof message.accessExpiresAt === 'number'
        ) {
          accessExpiresAtRef.current = message.accessExpiresAt;
        } else if (message.type === 'logout' && message.reason) {
          void performLogout(message.reason, true);
        }
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== ACTIVITY_STORAGE_KEY || !event.newValue) return;
      const at = Number(event.newValue);
      if (Number.isFinite(at)) {
        markActivity(at, false);
        setWarning(null);
        setWarningError(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
      channelRef.current = null;
    };
  }, [markActivity, performLogout, session.sessionPolicy.idleTimeoutMinutes]);

  React.useEffect(() => {
    const onActivity = () => recordUserActivity();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        recordUserActivity();
        void maybeRefresh();
      }
    };
    const onPageShow = () => {
      recordUserActivity();
      void maybeRefresh();
    };
    const onExpired = () => void performLogout('refresh_failed');
    const onRefreshed = (event: Event) => {
      const expiresAt = (event as CustomEvent<{ accessExpiresAt?: number }>)
        .detail?.accessExpiresAt;
      if (expiresAt) {
        accessExpiresAtRef.current = expiresAt;
        channelRef.current?.postMessage({
          type: 'refreshed',
          accessExpiresAt: expiresAt,
        });
      }
    };

    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    window.addEventListener('touchstart', onActivity, { passive: true });
    window.addEventListener('wheel', onActivity, { passive: true });
    window.addEventListener('scroll', onActivity, {
      passive: true,
      capture: true,
    });
    window.addEventListener('focus', onPageShow);
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('swe:session-expired', onExpired);
    window.addEventListener('swe:session-refreshed', onRefreshed);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
      window.removeEventListener('touchstart', onActivity);
      window.removeEventListener('wheel', onActivity);
      window.removeEventListener('scroll', onActivity, true);
      window.removeEventListener('focus', onPageShow);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('swe:session-expired', onExpired);
      window.removeEventListener('swe:session-refreshed', onRefreshed);
    };
  }, [maybeRefresh, performLogout, recordUserActivity]);

  React.useEffect(() => {
    recordUserActivity();
  }, [pathname, recordUserActivity]);

  React.useEffect(() => {
    const evaluate = () => {
      const now = Date.now();
      const decision = evaluateSessionLifecycle({
        now,
        lastActivityAt: lastActivityRef.current,
        absoluteExpiresAt: session.absoluteExpiresAt,
        warningDeadline: warning?.deadline,
        focusMode: focusModesRef.current.size > 0,
        policy: session.sessionPolicy,
      });
      if (decision.type === 'absolute-expiry') {
        void performLogout('absolute_expiry');
        return;
      }
      if (decision.type === 'idle-logout') {
        void performLogout('idle');
        return;
      }
      if (decision.type === 'countdown') {
        setRemainingSeconds(decision.remainingSeconds);
        return;
      }
      if (decision.type === 'warn') {
        setRemainingSeconds(decision.durationSeconds);
        setWarning({
          deadline: now + decision.durationSeconds * 1000,
          durationSeconds: decision.durationSeconds,
          focus: decision.focus,
        });
      }
      void maybeRefresh();
    };
    evaluate();
    const timer = window.setInterval(evaluate, 1_000);
    return () => window.clearInterval(timer);
  }, [
    maybeRefresh,
    performLogout,
    session.absoluteExpiresAt,
    session.sessionPolicy,
    warning,
  ]);

  const staySignedIn = React.useCallback(() => {
    setWarningError(null);
    startRefreshTransition(async () => {
      const result = await refreshBrowserSession();
      if (!result.success) {
        setWarningError(
          result.failure === 'unavailable'
            ? 'You appear to be offline. Reconnect, then try again.'
            : 'Your session has ended. Sign in again to continue.',
        );
        if (result.failure === 'unauthorized') {
          await performLogout('refresh_failed');
        }
        return;
      }
      const now = Date.now();
      if (result.accessExpiresAt)
        accessExpiresAtRef.current = result.accessExpiresAt;
      lastActivityRef.current = now;
      persistActivity(now);
      setWarning(null);
      setWarningError(null);
    });
  }, [performLogout, persistActivity]);

  const registerFocusMode = React.useCallback(
    (key: string, kind: FocusKind, active: boolean) => {
      if (active) focusModesRef.current.set(key, kind);
      else focusModesRef.current.delete(key);
      return () => {
        focusModesRef.current.delete(key);
      };
    },
    [],
  );

  const registerResumableModal = React.useCallback(
    (key: ResumableModalKey, registration: ModalRegistration) => {
      modalsRef.current.set(key, registration);
      if (readPendingModal() === key) {
        clearPendingModal();
        window.setTimeout(registration.reopen, 0);
      }
      return () => {
        modalsRef.current.delete(key);
      };
    },
    [],
  );

  const contextValue = React.useMemo(
    () => ({
      registerFocusMode,
      registerResumableModal,
      signOut: () => performLogout('manual'),
      reportActivity: recordUserActivity,
    }),
    [
      performLogout,
      recordUserActivity,
      registerFocusMode,
      registerResumableModal,
    ],
  );

  const warningProgress = warning
    ? Math.max(
        0,
        Math.min(100, (remainingSeconds / warning.durationSeconds) * 100),
      )
    : 0;

  return (
    <SessionLifecycleContext.Provider value={contextValue}>
      {children}
      <Dialog open={Boolean(warning)}>
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <div className="mb-2 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                {warning?.focus ? (
                  <ShieldCheck className="size-5" />
                ) : (
                  <Clock3 className="size-5" />
                )}
              </span>
              <div className="font-mono text-3xl font-semibold tabular-nums text-foreground">
                {formatCountdown(remainingSeconds)}
              </div>
            </div>
            <DialogTitle>Are you still active?</DialogTitle>
            <DialogDescription>
              {warning?.focus
                ? 'Your work is protected, but we need a quick confirmation before keeping this session open.'
                : 'For your security, this session will close unless you confirm that you are still here.'}
            </DialogDescription>
          </DialogHeader>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Time remaining before sign out"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(warningProgress)}
          >
            <div
              className={`h-full rounded-full transition-[width,background-color] duration-1000 ${remainingSeconds <= 30 ? 'bg-destructive' : 'bg-primary'}`}
              style={{ width: `${warningProgress}%` }}
            />
          </div>
          {warningError ? (
            <p className="text-sm text-destructive" role="alert">
              {warningError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => void performLogout('idle')}
              disabled={isRefreshing}
            >
              Sign out now
            </Button>
            <Button onClick={staySignedIn} disabled={isRefreshing}>
              {isRefreshing ? 'Confirming…' : "I'm still here"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SessionLifecycleContext.Provider>
  );
}

export function useSessionActivityMode({
  kind,
  active,
}: {
  kind: FocusKind;
  active: boolean;
}) {
  const context = React.useContext(SessionLifecycleContext);
  const key = React.useId();
  React.useEffect(() => {
    if (!context) return;
    return context.registerFocusMode(key, kind, active);
  }, [active, context, key, kind]);
}

export function useResumableModal(
  key: ResumableModalKey,
  open: boolean,
  reopen: () => void,
) {
  const context = React.useContext(SessionLifecycleContext);
  const reopenRef = React.useRef(reopen);
  React.useEffect(() => {
    reopenRef.current = reopen;
  }, [reopen]);
  React.useEffect(() => {
    if (!context) return;
    return context.registerResumableModal(key, {
      open,
      reopen: () => reopenRef.current(),
    });
  }, [context, key, open]);
}

export function useSessionLifecycle() {
  const context = React.useContext(SessionLifecycleContext);
  if (!context) {
    throw new Error(
      'useSessionLifecycle must be used within SessionLifecycleProvider',
    );
  }
  return context;
}

/** For semantic activity such as visible media playback progress. */
export function useSessionActivityReporter() {
  return useSessionLifecycle().reportActivity;
}
