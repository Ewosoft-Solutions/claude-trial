'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Card } from '@workspace/ui/components/card';
import { OtpInput } from '@workspace/ui/components/otp-input';

import { COOKIE_LAST_USER } from '@/lib/auth-cookies';
import { ACTIVITY_STORAGE_KEY } from '@/lib/session-lifecycle';
import {
  clearMissingPasskeyIntent,
  recordMissingPasskeyIntent,
} from '@/lib/biometric-reminder';
import {
  canAttemptPasskey,
  isConditionalMediationAvailable,
  platformPasskeyLabel,
  startAuthentication,
} from '@/lib/webauthn';

type MfaState = {
  challengeId: string;
  mfaMethodType: string;
};

/**
 * Credentials held in memory for the duration of a sign-in attempt.
 *
 * Forced rotation can surface either straight after the password (no MFA) or
 * after the second factor, and POST /auth/change-password takes no token — the
 * email and current password ARE the credential it re-validates. So both have
 * to survive from the password step to the rotation step. Cleared as soon as
 * the attempt ends, one way or the other.
 */
type PendingCredentials = { email: string; password: string };

type UserHint = { firstName: string; email: string };

/** Read the readable returning-user hint cookie (first name + email). */
function readHint(): UserHint | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE_LAST_USER}=`));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(raw.slice(COOKIE_LAST_USER.length + 1)),
    );
    if (parsed && typeof parsed.email === 'string') {
      return { firstName: parsed.firstName ?? '', email: parsed.email };
    }
  } catch {
    // malformed cookie — ignore
  }
  return null;
}

/** Time-of-day greeting, to match the returning-user welcome. */
function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function recordFreshLoginActivity() {
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable in private browsing; login still succeeds.
  }
}

/** `schoolName` is set when the login page is reached on a `{slug}.domain`
 *  subdomain — the page brands itself for that school. */
export function LoginForm({ schoolName }: { schoolName?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<MfaState | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [pending, setPending] = useState<PendingCredentials | null>(null);
  const [mustRotate, setMustRotate] = useState(false);

  const [hint, setHint] = useState<UserHint | null>(null);
  const [passkeyReady, setPasskeyReady] = useState(false);
  const [authLabel, setAuthLabel] = useState('your device');

  useEffect(() => {
    const h = readHint();
    setHint(h);
    setAuthLabel(platformPasskeyLabel());
    // The explicit button only needs WebAuthn itself. iOS standalone PWAs can
    // return a false negative from the platform-authenticator advisory probe;
    // the user-triggered ceremony below is the authoritative availability test.
    setPasskeyReady(canAttemptPasskey());

    // Conditional UI ("passkey autofill"): in fresh mode, quietly offer any
    // discoverable passkey inline on the sign-in fields. Resolves only when the
    // user picks one; otherwise it sits idle and the password form still works.
    if (h) return;
    const controller = new AbortController();
    void (async () => {
      try {
        if (!(await isConditionalMediationAvailable())) return;
        const optRes = await fetch('/api/auth/passkey/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        const optData = await optRes.json();
        if (!optRes.ok || !optData?.options) return;

        const assertion = await startAuthentication(optData.options, {
          conditional: true,
          signal: controller.signal,
        });

        const verifyRes = await fetch('/api/auth/passkey/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: optData.challengeId,
            authenticationResponse: assertion,
          }),
        });
        const verifyData = await verifyRes.json();
        if (verifyRes.ok) {
          recordFreshLoginActivity();
          router.push(verifyData.redirectTo ?? '/overview');
          router.refresh();
        }
      } catch {
        // Aborted, dismissed, or unsupported — stay on the password form.
      }
    })();
    return () => controller.abort();
  }, [router]);

  function switchAccount() {
    document.cookie = `${COOKIE_LAST_USER}=; Path=/; Max-Age=0`;
    clearMissingPasskeyIntent();
    setHint(null);
    setError(null);
  }

  function goToApp(redirectTo?: string) {
    recordFreshLoginActivity();
    setPending(null);
    router.push(redirectTo ?? '/overview');
    router.refresh();
  }

  /** Drop out of every in-progress step, discarding the held credentials. */
  function resetAttempt() {
    setMfa(null);
    setOtpCode('');
    setMustRotate(false);
    setPending(null);
    setError(null);
  }

  function submitPassword(email: string, password: string) {
    setError(null);
    setPending({ email, password });
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setPending(null);
          setError(data.error ?? 'Sign in failed. Check your credentials.');
          return;
        }

        if (data.requiresMfa) {
          setOtpCode('');
          setMfa({
            challengeId: data.mfaChallengeId,
            mfaMethodType: data.mfaMethodType ?? 'email',
          });
          return;
        }

        // Assigned password that has never been rotated. No session exists yet
        // and none will until it changes, so this is a step, not an error.
        if (data.mustChangePassword) {
          setMfa(null);
          setMustRotate(true);
          return;
        }

        goToApp(data.redirectTo);
      } catch {
        setPending(null);
        setError('Unable to connect to the server. Please try again.');
      }
    });
  }

  function submitRotation(newPassword: string, confirmPassword: string) {
    if (!pending) return;

    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    if (newPassword === pending.password) {
      setError('Choose a password different from your current one.');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: pending.email,
            currentPassword: pending.password,
            newPassword,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          // Policy rejections come back phrased for display.
          setError(data.error ?? 'Could not update your password.');
          return;
        }

        // Rotation issues no session of its own, so sign in again with the new
        // password. That re-enters the normal flow rather than forking it —
        // note an MFA-enrolled user is challenged once more here, which is the
        // cost of the API keeping rotation entirely tokenless.
        setMustRotate(false);
        submitPassword(pending.email, newPassword);
      } catch {
        setError('Unable to connect to the server. Please try again.');
      }
    });
  }

  function handleRotation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    submitRotation(
      form.get('newPassword') as string,
      form.get('confirmPassword') as string,
    );
  }

  function handleFreshSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    submitPassword(form.get('email') as string, form.get('password') as string);
  }

  function handleReturningSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hint) return;
    const form = new FormData(e.currentTarget);
    submitPassword(hint.email, form.get('password') as string);
  }

  function handlePasskey() {
    if (!hint) return;
    setError(null);

    startTransition(async () => {
      try {
        const optRes = await fetch('/api/auth/passkey/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: hint.email }),
        });
        const optData = await optRes.json();

        if (!optRes.ok) {
          setError(optData.error ?? 'Passkey sign-in failed.');
          return;
        }
        if (!optData.hasPasskey) {
          recordMissingPasskeyIntent();
          setError('No passkey set — sign in with your password.');
          return;
        }

        const assertion = await startAuthentication(optData.options);

        const verifyRes = await fetch('/api/auth/passkey/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            challengeId: optData.challengeId,
            authenticationResponse: assertion,
          }),
        });
        const verifyData = await verifyRes.json();

        if (!verifyRes.ok) {
          setError(verifyData.error ?? 'Passkey sign-in failed.');
          return;
        }

        goToApp(verifyData.redirectTo);
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (name === 'NotAllowedError' || name === 'AbortError') {
          setError('Passkey sign-in was cancelled.');
        } else if (name === 'SecurityError') {
          // RP ID isn't valid for this origin (e.g. testing on localhost while
          // WEBAUTHN_RP_ID points at the tunnel host).
          setError(
            'Passkeys aren’t available on this web address — sign in with your password.',
          );
        } else {
          // Surface the real cause for diagnosis; the UI stays generic.
          console.error('[passkey] sign-in failed', err);
          setError('Passkey sign-in failed. Please try again.');
        }
      }
    });
  }

  function submitMfa(code: string) {
    if (code.length !== 6) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/verify-mfa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeId: mfa!.challengeId, code }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? 'Invalid code. Please try again.');
          setOtpCode('');
          return;
        }

        // The second factor was accepted, but the password still has to be
        // rotated before a session is issued.
        if (data.mustChangePassword) {
          setMfa(null);
          setOtpCode('');
          setMustRotate(true);
          return;
        }

        goToApp(data.redirectTo);
      } catch {
        setError('Unable to connect to the server. Please try again.');
      }
    });
  }

  function handleMfa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submitMfa(otpCode);
  }

  // --- Forced password rotation step ---
  // Reached from the password step, or from MFA for an enrolled user. There is
  // no way past it: the API issues no token until the password changes.
  if (mustRotate && pending) {
    return (
      <div className="grid h-svh w-full place-items-center px-4">
        <Card className="w-full max-w-sm p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              Choose a new password
            </h1>
            <p className="text-sm text-muted-foreground">
              This account is still using an assigned password. Set your own to
              finish signing in.
            </p>
          </div>

          <form onSubmit={handleRotation} className="space-y-4">
            {/* Lets a password manager attach the new credential to the right
                account, and offer to update the stored one. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={pending.email}
              readOnly
              tabIndex={-1}
              className="sr-only"
              aria-hidden="true"
            />

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Re-enter the new password"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Updating…' : 'Update password and sign in'}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline underline-offset-4"
              onClick={resetAttempt}
            >
              Back to sign in
            </button>
          </form>
        </Card>
      </div>
    );
  }

  // --- MFA step ---
  if (mfa) {
    const mfaHint =
      mfa.mfaMethodType === 'email'
        ? 'Check your email for a 6-digit code.'
        : 'Enter the 6-digit code from your authenticator app.';

    return (
      <div className="grid h-svh w-full place-items-center px-4">
        <Card className="w-full max-w-sm p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              Verify your identity
            </h1>
            <p className="text-sm text-muted-foreground">{mfaHint}</p>
          </div>

          <form onSubmit={handleMfa} className="space-y-6">
            <div className="space-y-3">
              <Label>Verification code</Label>
              <OtpInput
                value={otpCode}
                onChange={setOtpCode}
                onComplete={submitMfa}
                disabled={isPending}
                className="justify-center"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isPending || otpCode.length < 6}
            >
              {isPending ? 'Verifying…' : 'Verify'}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline underline-offset-4"
              onClick={resetAttempt}
            >
              Back to sign in
            </button>
          </form>
        </Card>
      </div>
    );
  }

  // --- Returning user: greeting + password-only + biometric ---
  if (hint) {
    return (
      <div className="grid h-svh w-full place-items-center px-4">
        <Card className="w-full max-w-sm p-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm text-muted-foreground">{timeGreeting()}</p>
              <h1 className="text-2xl font-bold tracking-tight">
                {hint.firstName || hint.email}
              </h1>
            </div>
            <button
              type="button"
              onClick={switchAccount}
              className="shrink-0 pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Switch account
            </button>
          </div>

          <form onSubmit={handleReturningSubmit} className="space-y-4">
            {/* Hidden username field so password managers associate the saved
                password with this account. A password-only form otherwise has
                nothing to bind the credential to, which makes autofill drop the
                password into the wrong field on the next screen. */}
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={hint.email}
              readOnly
              tabIndex={-1}
              className="sr-only"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="Enter password"
                autoFocus
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" className="flex-1" disabled={isPending}>
                {isPending ? 'Signing in…' : 'Log in'}
              </Button>
              {passkeyReady && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handlePasskey}
                  disabled={isPending}
                  aria-label={`Sign in with ${authLabel}`}
                  title={`Sign in with ${authLabel}`}
                >
                  <Fingerprint className="size-5" />
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    );
  }

  // --- Fresh / switched account: full email + password ---
  return (
    <div className="grid h-svh w-full place-items-center px-4">
      <Card className="w-full max-w-sm p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {schoolName ? `Sign in to ${schoolName}` : 'Sign in'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to access your school.
          </p>
        </div>

        <form onSubmit={handleFreshSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              // "webauthn" lets discoverable passkeys surface in this field's
              // autofill (conditional UI); "username" keeps password managers happy.
              autoComplete="username webauthn"
              required
              placeholder="you@school.edu"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Log in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
