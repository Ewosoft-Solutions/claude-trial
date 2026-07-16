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
import {
  isPlatformAuthenticatorAvailable,
  platformPasskeyLabel,
  startAuthentication,
} from '@/lib/webauthn';

type MfaState = {
  challengeId: string;
  mfaMethodType: string;
};

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

/** `schoolName` is set when the login page is reached on a `{slug}.domain`
 *  subdomain — the page brands itself for that school. */
export function LoginForm({ schoolName }: { schoolName?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<MfaState | null>(null);
  const [otpCode, setOtpCode] = useState('');

  const [hint, setHint] = useState<UserHint | null>(null);
  const [passkeyReady, setPasskeyReady] = useState(false);
  const [authLabel, setAuthLabel] = useState('your device');

  useEffect(() => {
    setHint(readHint());
    setAuthLabel(platformPasskeyLabel());
    isPlatformAuthenticatorAvailable().then(setPasskeyReady);
  }, []);

  function switchAccount() {
    document.cookie = `${COOKIE_LAST_USER}=; Path=/; Max-Age=0`;
    setHint(null);
    setError(null);
  }

  function goToApp(redirectTo?: string) {
    router.push(redirectTo ?? '/overview');
    router.refresh();
  }

  function submitPassword(email: string, password: string) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
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

        goToApp(data.redirectTo);
      } catch {
        setError('Unable to connect to the server. Please try again.');
      }
    });
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
          setError('No passkey on file — sign in with your password.');
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
              onClick={() => {
                setMfa(null);
                setOtpCode('');
                setError(null);
              }}
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
              autoComplete="email"
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
