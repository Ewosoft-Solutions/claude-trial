'use client';

/* ============================================================
   InviteUser — create + share a tenant invitation

   Reusable across the Platform console (invite a school's first owner)
   and Settings › Users (invite staff). Posts to
   /api/tenant/:id/invitations, then surfaces a copyable accept link
   (interim delivery until invitation email exists).
   ============================================================ */

import { useEffect, useState } from 'react';
import { Check, Copy, Send } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';

interface Role {
  id: string;
  name: string;
  clearanceLevel: number | null;
  roleType: string | null;
}

interface CreatedInvite {
  invitationToken: string;
  email: string;
}

export interface InviteUserProps {
  tenantId: string;
  /** Only offer roles up to this clearance (default 8 = school-level). */
  maxClearance?: number;
  /** Preferred default role name, if present. */
  defaultRoleName?: string;
  onInvited?: () => void;
}

export function InviteUser({
  tenantId,
  maxClearance = 8,
  defaultRoleName = 'Owner',
  onInvited,
}: InviteUserProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/roles')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Role[]) => {
        if (!active) return;
        const assignable = (Array.isArray(data) ? data : [])
          .filter(
            (r) =>
              r.roleType !== 'platform' &&
              (r.clearanceLevel ?? 99) >= 1 &&
              (r.clearanceLevel ?? 99) <= maxClearance,
          )
          .sort((a, b) => (b.clearanceLevel ?? 0) - (a.clearanceLevel ?? 0));
        setRoles(assignable);
        const preferred = assignable.find((r) => r.name === defaultRoleName);
        setRoleId(preferred?.id ?? assignable[0]?.id ?? '');
      })
      .catch(() => setRoles([]));
    return () => {
      active = false;
    };
  }, [maxClearance, defaultRoleName]);

  const acceptUrl = created
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/accept-invite?token=${created.invitationToken}`
    : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenant/${tenantId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          roleId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Failed to create invitation');
      setCreated(body as CreatedInvite);
      onInvited?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable; the link is still selectable */
    }
  }

  if (created) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm">
          Invitation created for <strong>{created.email}</strong>. Share this
          link so they can set a password and join (email delivery is coming
          soon):
        </p>
        <div className="flex items-center gap-2">
          <Input readOnly value={acceptUrl} className="font-mono text-xs" />
          <Button type="button" size="sm" variant="outline" onClick={copyLink}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setCreated(null);
              setEmail('');
              setFirstName('');
              setLastName('');
            }}
          >
            Invite another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@school.edu"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-first">First name</Label>
          <Input
            id="invite-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="invite-last">Last name</Label>
          <Input
            id="invite-last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger id="invite-role">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div>
        <Button
          type="submit"
          size="sm"
          disabled={submitting || !email.trim() || !roleId}
        >
          <Send className="size-4" />
          {submitting ? 'Sending…' : 'Create invitation'}
        </Button>
      </div>
    </form>
  );
}
