'use client';

/* ============================================================
   /forgot-password — request a password-reset link

   Public. Posts the email to the API, which emails a one-hour reset
   link when it matches an account. Always shows the same "check your
   email" confirmation so the page can't be used to probe which
   addresses have accounts.
   ============================================================ */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Card } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';

export function ForgotPasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/request-password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(
            body?.error ?? 'Could not start the reset. Please try again.',
          );
          return;
        }
        setSent(true);
      } catch {
        setError('Unable to connect to the server. Please try again.');
      }
    });
  }

  return (
    <div className="grid h-svh w-full place-items-center px-4">
      <Card className="w-full max-w-sm space-y-6 p-8">
        {sent ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <MailCheck className="size-8 text-success" />
            <h1 className="text-xl font-semibold tracking-tight">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent
              a link to reset your password. It expires in one hour.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">
                Reset your password
              </h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a link to set a new
                password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="you@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Sending…' : 'Send reset link'}
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
