'use client';

/**
 * WB1-6 · Access & scope on the person detail.
 *
 * The time-boxed + scoped access surface, gated `access.grants.manage`:
 *   - the profile's ACTIVE grant (role · campus scope · expiry countdown) + revoke
 *   - a "Grant role" dialog (role → scope → optional expiry → reason). A high-risk
 *     grant does not apply immediately — it raises a maker-checker request.
 *   - PENDING requests rendered via the F8 ApprovalPanel: before → after, a
 *     separation-of-duties block when the reviewer is the requester, and a
 *     step-up notice. Approve/reject call the guarded endpoints.
 *
 * Server-side permission + maker-checker + step-up are authoritative; the client
 * only decides what renders and surfaces the API's messages.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { CalendarClock, MapPin, ShieldCheck, UserCog } from 'lucide-react';

import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetTrigger,
} from '@workspace/ui/components/sheet';
import {
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/custom/detail/drawer-chrome';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { ApprovalPanel } from '@workspace/ui/custom/approval/approval-panel';

import { STEP_UP_OPERATION } from '@/lib/step-up';
import { useStepUpAction } from '../../_shared/use-step-up-action';
import { Section, DetailGrid, Field } from '../person-detail-ui';
import { formatDate } from '../person-detail.types';

interface Scope {
  type: string;
  value?: string;
  label?: string;
}
interface ActiveGrant {
  roleId: string;
  roleName: string | null;
  scope: Scope | null;
  expiresAt: string | null;
  expired: boolean;
  grantReason: string | null;
  assignedAt: string | null;
}
interface PendingRequest {
  requestId: string;
  roleId: string;
  scope: Scope | null;
  expiresAt: string | null;
  reason: string | null;
  makerId: string;
  createdAt: string;
}
interface GrantState {
  profileId: string;
  activeGrant: ActiveGrant | null;
  pendingRequests: PendingRequest[];
}
interface Campus {
  id: string;
  name: string;
  code: string;
}
interface Role {
  id: string;
  name: string;
}

const GLOBAL = '__global__';

export function AccessScopePanel({
  personId,
  currentUserId,
  canManage,
}: {
  personId: string;
  currentUserId: string;
  canManage: boolean;
}) {
  const [profileId, setProfileId] = React.useState<string | null>(null);
  const [noAccount, setNoAccount] = React.useState(false);
  const [state, setState] = React.useState<GrantState | null>(null);
  const [campuses, setCampuses] = React.useState<Campus[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // Granting/approving is step-up-gated (users.role.assign) — the shared prompt
  // runs the MFA ceremony and hands back a challenge id to send with the write.
  const { requestStepUp, stepUpPrompt } = useStepUpAction();

  // Grant dialog form
  const [open, setOpen] = React.useState(false);
  const [roleId, setRoleId] = React.useState('');
  const [scopeValue, setScopeValue] = React.useState(GLOBAL);
  const [expiresAt, setExpiresAt] = React.useState('');
  const [reason, setReason] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Resolve the person's login profile from the account surface.
      const accountRes = await fetch(
        `/api/directory/people/${personId}/account`,
        { cache: 'no-store' },
      );
      if (!accountRes.ok) throw new Error(String(accountRes.status));
      const account = (await accountRes.json()) as {
        hasAccount: boolean;
        userTenantId?: string;
      };
      if (!account.hasAccount || !account.userTenantId) {
        setNoAccount(true);
        setState(null);
        return;
      }
      const pid = account.userTenantId;
      setProfileId(pid);
      setNoAccount(false);

      const [grantsRes, campusesRes, rolesRes] = await Promise.all([
        fetch(`/api/access/profiles/${pid}/grants`, { cache: 'no-store' }),
        fetch('/api/campuses', { cache: 'no-store' }),
        fetch('/api/roles', { cache: 'no-store' }),
      ]);
      if (!grantsRes.ok) throw new Error(String(grantsRes.status));
      setState((await grantsRes.json()) as GrantState);
      setCampuses(
        campusesRes.ok ? ((await campusesRes.json()) as Campus[]) : [],
      );
      const roleList = rolesRes.ok ? ((await rolesRes.json()) as Role[]) : [];
      setRoles(roleList);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const post = React.useCallback(
    async (path: string, body: unknown, successMsg: string) => {
      setBusy(true);
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        });
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
          status?: string;
        } | null;
        if (!res.ok) {
          // A 401 means the session lapsed — the API's raw "invalid token" text
          // isn't actionable, so say what to do. Otherwise surface the API's
          // message (the proxy sends it under `error`, e.g. a step-up prompt).
          throw new Error(
            res.status === 401
              ? 'Your session has expired — please sign in again.'
              : (data?.error ??
                  data?.message ??
                  `Request failed (${res.status})`),
          );
        }
        toast.success(
          data?.status === 'pending_approval'
            ? 'Sent for a second approval (high-risk grant)'
            : successMsg,
        );
        await load();
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Something went wrong');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const submitGrant = React.useCallback(() => {
    if (!profileId || !roleId) return;
    const scope =
      scopeValue === GLOBAL
        ? { type: 'global' }
        : { type: 'campus', value: scopeValue };
    const body = {
      profileId,
      roleId,
      scope,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      reason: reason.trim() || undefined,
    };
    // Close the grant dialog while the step-up drawer is up; the form state is
    // retained, so a cancelled confirmation reopens unchanged.
    setOpen(false);
    requestStepUp(
      {
        operation: STEP_UP_OPERATION.USERS_ROLE_ASSIGN,
        title: 'Confirm it’s you',
        description:
          'Granting a role is a sensitive change and needs a fresh identity check.',
      },
      async (stepUpChallengeId) => {
        const ok = await post(
          '/api/access/grants',
          { ...body, stepUpChallengeId },
          'Access granted',
        );
        if (ok) {
          setRoleId('');
          setScopeValue(GLOBAL);
          setExpiresAt('');
          setReason('');
        }
      },
    );
  }, [profileId, roleId, scopeValue, expiresAt, reason, post, requestStepUp]);

  const roleName = React.useCallback(
    (id: string) => roles.find((r) => r.id === id)?.name ?? id,
    [roles],
  );

  if (loading) {
    return (
      <Section title="Access & scope">
        <p className="text-sm text-muted-foreground">Loading access…</p>
      </Section>
    );
  }
  if (error) {
    return (
      <Section title="Access & scope">
        <p className="text-sm text-destructive">
          Could not load access.{' '}
          <button className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      </Section>
    );
  }
  if (noAccount) {
    return (
      <Section title="Access & scope">
        <p className="text-sm text-muted-foreground">
          This person has no login yet. Invite them first, then grant a role.
        </p>
      </Section>
    );
  }

  const active = state?.activeGrant ?? null;
  const pending = state?.pendingRequests ?? [];

  return (
    <Section
      title="Access & scope"
      action={
        canManage ? (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button size="sm" variant="secondary">
                <UserCog className="size-4" /> Grant role
              </Button>
            </SheetTrigger>
            <DrawerContent>
              <DrawerHeader className="gap-1.5">
                <DrawerTitle className="pr-8">Grant a role</DrawerTitle>
                <SheetDescription className="text-[calc(12.5px*var(--font-scale))]">
                  Optionally scope it to a campus and set an expiry for
                  temporary cover. A high-risk role needs a second approval.
                </SheetDescription>
              </DrawerHeader>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>Role</Label>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a role" />
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
                  <div className="flex flex-col gap-1.5">
                    <Label>Scope</Label>
                    <Select value={scopeValue} onValueChange={setScopeValue}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={GLOBAL}>
                          Whole school (unscoped)
                        </SelectItem>
                        {campuses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="grant-expiry">Expires (optional)</Label>
                    <Input
                      id="grant-expiry"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="grant-reason">Reason (optional)</Label>
                    <Textarea
                      id="grant-reason"
                      value={reason}
                      placeholder="e.g. 5-day cover for Ms Ada"
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DrawerFooter className="flex-row justify-end gap-2">
                <SheetClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </SheetClose>
                <Button
                  onClick={() => void submitGrant()}
                  disabled={busy || !roleId}
                >
                  Grant
                </Button>
              </DrawerFooter>
            </DrawerContent>
          </Sheet>
        ) : undefined
      }
    >
      {active ? (
        <div className="flex flex-col gap-3">
          <DetailGrid>
            <Field label="Role" value={active.roleName} />
            <Field
              label="Scope"
              value={
                active.scope && active.scope.type !== 'global' ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {active.scope.label ?? active.scope.value}
                  </span>
                ) : (
                  'Whole school'
                )
              }
            />
            <Field
              label="Expires"
              value={
                active.expiresAt ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-3.5" />
                    {formatDate(active.expiresAt)}
                    {active.expired ? (
                      <StatusBadge tone="destructive">Expired</StatusBadge>
                    ) : (
                      <StatusBadge tone="warning">Temporary</StatusBadge>
                    )}
                  </span>
                ) : (
                  'No expiry'
                )
              }
            />
            <Field label="Reason" value={active.grantReason ?? '—'} />
          </DetailGrid>
          {canManage ? (
            <div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={() =>
                  void post(
                    `/api/access/profiles/${profileId}/revoke`,
                    {},
                    'Grant revoked',
                  )
                }
              >
                Revoke grant
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No role granted on this profile yet.
        </p>
      )}

      {pending.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4" /> Pending approval
          </p>
          {pending.map((req) => (
            <ApprovalPanel
              key={req.requestId}
              request={{
                title: `Grant ${roleName(req.roleId)}`,
                requestedBy:
                  req.makerId === currentUserId ? 'you' : 'a colleague',
                requestedAt: formatDate(req.createdAt) ?? undefined,
                reason: req.reason ?? undefined,
                riskLabel: 'High-risk',
              }}
              fields={[
                {
                  key: 'role',
                  label: 'Role',
                  before: active?.roleName ?? 'none',
                  after: roleName(req.roleId),
                },
                {
                  key: 'scope',
                  label: 'Scope',
                  before: '—',
                  after:
                    req.scope && req.scope.type !== 'global'
                      ? (req.scope.label ?? req.scope.value)
                      : 'Whole school',
                },
                {
                  key: 'expiry',
                  label: 'Expires',
                  before: '—',
                  after: req.expiresAt
                    ? formatDate(req.expiresAt)
                    : 'No expiry',
                },
              ]}
              canApprove={canManage}
              isSelfRequest={req.makerId === currentUserId}
              stepUpRequired
              onApprove={() =>
                requestStepUp(
                  {
                    operation: STEP_UP_OPERATION.USERS_ROLE_ASSIGN,
                    title: 'Confirm it’s you',
                    description:
                      'Approving a high-risk grant needs a fresh identity check.',
                  },
                  (stepUpChallengeId) => {
                    void post(
                      `/api/access/grants/${req.requestId}/approve`,
                      { stepUpChallengeId },
                      'Grant approved',
                    );
                  },
                )
              }
              onReject={() =>
                void post(
                  `/api/access/grants/${req.requestId}/reject`,
                  { reason: 'Rejected' },
                  'Request rejected',
                )
              }
            />
          ))}
        </div>
      ) : null}

      {stepUpPrompt}
    </Section>
  );
}
