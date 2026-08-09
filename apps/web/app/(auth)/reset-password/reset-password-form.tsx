'use client';

/* ============================================================
   /reset-password — set a new password from an emailed token

   Public. The `?token=` in the link IS the credential; the API
   re-validates it (expiry, single-use) and enforces the account's
   effective password policy. We show a strength meter against the
   baseline policy (the loosest any tenant can set); a stricter
   tenant's extra requirements surface as the API's phrased error.
   ============================================================ */

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import { Card } from '@workspace/ui/components/card';
import { Label } from '@workspace/ui/components/label';
import { PasswordInput } from '@workspace/ui/components/password-input';
import {
  evaluatePassword,
  PasswordStrengthMeter,
  type PasswordRequirements,
} from '@workspace/ui/components/password-strength';

// Baseline (platform default / Basic tier). The server enforces the account's
// actual — possibly stricter — effective policy.
const BASELINE_POLICY: PasswordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
};

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!evaluatePassword(BASELINE_POLICY, password).allMet) {
      setError('Your password does not meet all the requirements below.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword: password }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(
            body?.error ??
              'Could not reset your password. The link may have expired.',
          );
          return;
        }
        setDone(true);
        setTimeout(() => router.push('/login'), 2500);
      } catch {
        setError('Unable to connect to the server. Please try again.');
      }
    });
  }

  return (
    <div className="grid h-svh w-full place-items-center px-4">
      <Card className="w-full max-w-sm space-y-6 p-8">
        {!token ? (
          <div className="flex flex-col gap-3">
            <PageTitle>Reset link invalid</PageTitle>
            <p className="text-sm text-muted-foreground">
              This link is missing its token. Request a new password-reset email
              and try again.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <CheckCircle2 className="size-8 text-success" />
            <PageTitle>Password updated</PageTitle>
            <p className="text-sm text-muted-foreground">
              You can now sign in with your new password. Redirecting you to
              sign in…
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <PageTitle>Choose a new password</PageTitle>
              <p className="text-sm text-muted-foreground">
                Set a new password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Hidden username field so password managers can update the saved
                  credential. */}
              <input
                type="text"
                name="username"
                autoComplete="username"
                readOnly
                tabIndex={-1}
                className="sr-only"
                aria-hidden="true"
              />

              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  required
                  minLength={BASELINE_POLICY.minLength}
                  placeholder={`At least ${BASELINE_POLICY.minLength} characters`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>

              <PasswordStrengthMeter
                policy={BASELINE_POLICY}
                value={password}
              />

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  minLength={BASELINE_POLICY.minLength}
                  placeholder="Re-enter the new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Updating…' : 'Update password'}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
