'use client';

/**
 * WB1-3 · Account & access management on the person detail.
 *
 * Renders a person's login lifecycle and the provisioning actions gated on
 * `users.provision`: invite (SecureLink; the person sets their own password),
 * resend, suspend (blocks login), reactivate, and send a password-reset link.
 * No password is ever shown or set here — every action hands off to the secure
 * flow. Server-side permission checks are authoritative; `canProvision` only
 * decides whether the actions render.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { KeyRound, Mail, ShieldOff, UserPlus } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import type { StateTone } from '@workspace/ui/types/states.types';

import { Section, DetailGrid, Field } from '../person-detail-ui';
import { formatDate } from '../person-detail.types';

interface AccountState {
  hasAccount: boolean;
  canInvite?: boolean;
  userTenantId?: string;
  email?: string | null;
  role?: string | null;
  status?: string;
  suspended?: boolean;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  lastLoginAt?: string | null;
  invitation?: {
    state: 'pending' | 'expired';
    expiresAt: string | null;
  } | null;
}

interface Role {
  id: string;
  name: string;
}

const STATUS_TONE: Record<string, StateTone> = {
  active: 'success',
  pending: 'info',
  suspended: 'destructive',
  inactive: 'neutral',
};

export function AccountAccessPanel({
  personId,
  canProvision,
}: {
  personId: string;
  canProvision: boolean;
}) {
  const [state, setState] = React.useState<AccountState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const base = `/api/directory/people/${personId}/account`;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(base, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      setState((await res.json()) as AccountState);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [base]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const act = React.useCallback(
    async (action: string, body?: unknown, successMsg?: string) => {
      setBusy(true);
      try {
        const res = await fetch(`${base}/${action}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(data?.message ?? `Request failed (${res.status})`);
        }
        toast.success(successMsg ?? 'Done');
        await load();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Something went wrong');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [base, load],
  );

  return (
    <Section title="Account &amp; access">
      {loading ? (
        <div
          className="h-24 animate-pulse rounded-lg border border-border bg-card/40"
          aria-hidden
        />
      ) : error ? (
        <div className="rounded-lg border border-border bg-card/40 p-4 text-sm">
          <p className="text-muted-foreground">Could not load account state.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void load()}
          >
            Retry
          </Button>
        </div>
      ) : state ? (
        <AccountBody
          state={state}
          canProvision={canProvision}
          busy={busy}
          act={act}
        />
      ) : null}
    </Section>
  );
}

function AccountBody({
  state,
  canProvision,
  busy,
  act,
}: {
  state: AccountState;
  canProvision: boolean;
  busy: boolean;
  act: (a: string, b?: unknown, m?: string) => Promise<boolean>;
}) {
  if (!state.hasAccount) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-4">
        <p className="text-sm text-muted-foreground">
          This person has no login yet.
        </p>
        {canProvision && state.canInvite ? (
          <InviteDialog busy={busy} act={act} />
        ) : !canProvision ? (
          <p className="text-xs text-muted-foreground">
            You do not have permission to provision accounts.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            An account can be created once the person record is active.
          </p>
        )}
      </div>
    );
  }

  const invite = state.invitation;
  const tone =
    invite?.state === 'expired'
      ? 'warning'
      : (STATUS_TONE[state.status ?? ''] ?? 'neutral');
  const statusLabel = invite
    ? invite.state === 'expired'
      ? 'Invitation expired'
      : 'Invitation pending'
    : (state.status ?? 'unknown');

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={tone} dot>
          {statusLabel}
        </StatusBadge>
        {state.suspended && state.suspensionReason ? (
          <span className="text-xs text-muted-foreground">
            {state.suspensionReason}
          </span>
        ) : null}
      </div>

      <DetailGrid>
        <Field label="Login email" value={state.email} />
        <Field label="Role" value={state.role} />
        <Field
          label="Last login"
          value={formatDate(state.lastLoginAt ?? null)}
        />
        {invite ? (
          <Field label="Invite expires" value={formatDate(invite.expiresAt)} />
        ) : state.suspended ? (
          <Field
            label="Suspended"
            value={formatDate(state.suspendedAt ?? null)}
          />
        ) : null}
      </DetailGrid>

      {canProvision ? (
        <div className="flex flex-wrap gap-2">
          {invite ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void act('resend-invite', {}, 'Invitation re-sent')
              }
            >
              <Mail aria-hidden /> Resend invitation
            </Button>
          ) : null}

          {state.suspended ? (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void act('reactivate', {}, 'Account reactivated')}
            >
              Reactivate
            </Button>
          ) : (
            <>
              {!invite ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void act('reset-password', {}, 'Password-reset link sent')
                  }
                >
                  <KeyRound aria-hidden /> Send reset link
                </Button>
              ) : null}
              <SuspendDialog busy={busy} act={act} />
            </>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          You do not have permission to manage this account.
        </p>
      )}
    </div>
  );
}

function InviteDialog({
  busy,
  act,
}: {
  busy: boolean;
  act: (a: string, b?: unknown, m?: string) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [roles, setRoles] = React.useState<Role[] | null>(null);
  const [roleId, setRoleId] = React.useState('');
  const [email, setEmail] = React.useState('');

  React.useEffect(() => {
    if (!open || roles) return;
    void (async () => {
      try {
        const res = await fetch('/api/roles', { cache: 'no-store' });
        const data = (await res.json()) as Role[] | { data?: Role[] };
        setRoles(Array.isArray(data) ? data : (data.data ?? []));
      } catch {
        setRoles([]);
      }
    })();
  }, [open, roles]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        className="w-fit"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        <UserPlus aria-hidden /> Invite to create account
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to create an account</DialogTitle>
          <DialogDescription>
            We&rsquo;ll email a secure link. The person sets their own password
            — no password is ever generated or sent.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger id="invite-role">
                <SelectValue
                  placeholder={roles ? 'Choose a role' : 'Loading roles…'}
                />
              </SelectTrigger>
              <SelectContent>
                {(roles ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">
              Email <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="Defaults to the person's email on file"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            disabled={busy || !roleId}
            onClick={async () => {
              const ok = await act(
                'invite',
                { roleId, ...(email ? { email } : {}) },
                'Invitation sent',
              );
              if (ok) setOpen(false);
            }}
          >
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuspendDialog({
  busy,
  act,
}: {
  busy: boolean;
  act: (a: string, b?: unknown, m?: string) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="destructive"
        size="sm"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        <ShieldOff aria-hidden /> Suspend
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend this account?</DialogTitle>
          <DialogDescription>
            The person will be signed out and blocked from logging in until
            reactivated. This is audited.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5 py-2">
          <Label htmlFor="suspend-reason">
            Reason <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="suspend-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Left the organisation"
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={async () => {
              const ok = await act(
                'suspend',
                { reason: reason || undefined },
                'Account suspended',
              );
              if (ok) setOpen(false);
            }}
          >
            Suspend account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
