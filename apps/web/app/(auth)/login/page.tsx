'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Card } from '@workspace/ui/components/card';

type MfaState = {
  challengeId: string;
  mfaMethodType: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mfa, setMfa] = useState<MfaState | null>(null);

  function handleCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;

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
          setMfa({ challengeId: data.mfaChallengeId, mfaMethodType: data.mfaMethodType ?? 'email' });
          return;
        }

        router.push('/overview');
        router.refresh();
      } catch {
        setError('Unable to connect to the server. Please try again.');
      }
    });
  }

  function handleMfa(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const code = form.get('code') as string;

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
          return;
        }

        router.push('/overview');
        router.refresh();
      } catch {
        setError('Unable to connect to the server. Please try again.');
      }
    });
  }

  if (mfa) {
    const hint = mfa.mfaMethodType === 'email'
      ? 'Check your email for a 6-digit code.'
      : 'Enter the 6-digit code from your authenticator app.';

    return (
      <div className="grid h-svh w-full place-items-center px-4">
        <Card className="w-full max-w-sm p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Verify your identity</h1>
            <p className="text-sm text-muted-foreground">{hint}</p>
          </div>

          <form onSubmit={handleMfa} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="000000"
                autoFocus
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Verifying…' : 'Verify'}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground underline underline-offset-4"
              onClick={() => { setMfa(null); setError(null); }}
            >
              Back to sign in
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid h-svh w-full place-items-center px-4">
      <Card className="w-full max-w-sm p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to access your school.
          </p>
        </div>

        <form onSubmit={handleCredentials} className="space-y-4">
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
            {isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
