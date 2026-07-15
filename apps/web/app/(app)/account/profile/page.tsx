'use client';

import * as React from 'react';
import { Save, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';

import { useViewer } from '@/app/providers/viewer-provider';

export default function AccountProfilePage() {
  const { user } = useViewer();
  const router = useRouter();
  const inferred = user.name.trim().split(/\s+/);
  const [firstName, setFirstName] = React.useState(
    user.firstName ?? inferred[0] ?? '',
  );
  const [lastName, setLastName] = React.useState(
    user.lastName ?? inferred.slice(1).join(' '),
  );
  const [phone, setPhone] = React.useState(user.phone ?? '');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/auth/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, phone }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? 'Could not save profile.');
      setMessage('Profile updated.');
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not save profile.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Personal details that follow you across every school and role.
        </p>
      </div>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 text-primary" aria-hidden /> Personal
            details
          </CardTitle>
          <CardDescription>
            Your email is your sign-in identity. Changing it requires a separate
            verification flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="account-first-name">First name</Label>
              <Input
                id="account-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="account-last-name">Last name</Label>
              <Input
                id="account-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="account-email">Email</Label>
              <Input id="account-email" value={user.email ?? ''} disabled />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="account-phone">Phone</Label>
              <Input
                id="account-phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
              <span className="mr-auto text-sm" aria-live="polite">
                {message ? (
                  <span className="text-success">{message}</span>
                ) : null}
                {error ? (
                  <span className="text-destructive">{error}</span>
                ) : null}
              </span>
              <Button type="submit" disabled={saving}>
                <Save className="size-4" aria-hidden />
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
