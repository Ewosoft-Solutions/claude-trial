'use client';

/* ============================================================
   /accept-invite — public invitation acceptance (G6)

   The invitee (no account yet) opens the shared link with ?token=.
   We preview the invitation, let them set a password, accept via the
   public endpoint, then send them to /login.
   ============================================================ */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { Card } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';

interface Preview {
  valid: boolean;
  expired: boolean;
  email: string;
  firstName: string | null;
  lastName: string | null;
  tenantName: string;
  role: string | null;
}

export function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError('This invitation link is missing its token.');
      setLoading(false);
      return;
    }
    let active = true;
    fetch(`/api/invitations/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error || 'Invitation not found');
        return body as Preview;
      })
      .then((p) => {
        if (!active) return;
        setPreview(p);
        setFirstName(p.firstName ?? '');
        setLastName(p.lastName ?? '');
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : 'Error');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Failed to accept invitation');
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        ) : loadError ? (
          <div className="flex flex-col gap-3">
            <h1 className="text-lg font-semibold">Invitation unavailable</h1>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button variant="outline" onClick={() => router.push('/login')}>
              Go to sign in
            </Button>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-8 text-success" />
            <h1 className="text-lg font-semibold">You&apos;re all set</h1>
            <p className="text-sm text-muted-foreground">
              Your account is ready. Redirecting you to sign in…
            </p>
          </div>
        ) : preview && (preview.expired || !preview.valid) ? (
          <div className="flex flex-col gap-3">
            <h1 className="text-lg font-semibold">Invitation expired</h1>
            <p className="text-sm text-muted-foreground">
              This invitation to <strong>{preview.tenantName}</strong> is no
              longer valid. Ask an administrator to send a new one.
            </p>
            <Button variant="outline" onClick={() => router.push('/login')}>
              Go to sign in
            </Button>
          </div>
        ) : preview ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <h1 className="text-lg font-semibold">Accept your invitation</h1>
              <p className="text-sm text-muted-foreground">
                Join <strong>{preview.tenantName}</strong>
                {preview.role ? ` as ${preview.role}` : ''}. Set a password for{' '}
                <strong>{preview.email}</strong>.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="first">First name</Label>
                <Input
                  id="first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="last">Last name</Label>
                <Input
                  id="last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={submitting}>
              {submitting ? 'Setting up…' : 'Accept & create account'}
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
