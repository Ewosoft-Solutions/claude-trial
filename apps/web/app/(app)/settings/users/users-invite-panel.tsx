'use client';

/* ============================================================
   Users › invite panel (G7)

   Functional "Invite user" affordance + a live list of pending
   invitations with copyable accept links and revoke. Complements the
   server-rendered user table on the Users settings page.
   ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, UserPlus, X } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { InviteUser } from '../../_shared/invite-user';

interface Invitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
  token: string | null;
  acceptPath: string | null;
  invitationExpiresAt: string | null;
}

export function UsersInvitePanel({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Invitation[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    try {
      const res = await fetch(`/api/tenant/${tenantId}/invitations?status=pending`);
      if (!res.ok) return;
      const data = (await res.json()) as Invitation[];
      setPending(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
  }, [tenantId]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  async function revoke(id: string) {
    try {
      await fetch(`/api/tenant/${tenantId}/invitations/${id}`, {
        method: 'DELETE',
      });
      await loadPending();
    } catch {
      /* ignore */
    }
  }

  async function copy(inv: Invitation) {
    if (!inv.acceptPath) return;
    const url = `${window.location.origin}${inv.acceptPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">Invitations</CardTitle>
          <CardDescription>
            {pending.length} pending invitation{pending.length === 1 ? '' : 's'}
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <UserPlus /> {open ? 'Close' : 'Invite user'}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {open ? (
          <InviteUser
            tenantId={tenantId}
            defaultRoleName="Management"
            maxClearance={8}
            onInvited={loadPending}
          />
        ) : null}

        {pending.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <div className="break-all text-sm font-medium">{inv.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {inv.role ?? 'No role'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone="info" dot>
                    {inv.status}
                  </StatusBadge>
                  {inv.acceptPath ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copy(inv)}
                    >
                      {copiedId === inv.id ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      {copiedId === inv.id ? 'Copied' : 'Copy link'}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revoke(inv.id)}
                    aria-label="Revoke invitation"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
