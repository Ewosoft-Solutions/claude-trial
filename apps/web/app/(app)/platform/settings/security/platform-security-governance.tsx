'use client';

import * as React from 'react';
import useSWR from 'swr';
import { GitPullRequest, ShieldCheck, SlidersHorizontal } from 'lucide-react';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@workspace/ui/components/drawer';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Textarea } from '@workspace/ui/components/textarea';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';

import {
  SECURITY_CATEGORY_LABELS,
  type SensitiveOperationChangeRequest,
  type SensitiveOperationPolicy,
} from '@/lib/security-governance';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { StepUpPrompt } from '../../../_shared/step-up-prompt';

type PolicyPatch = Pick<
  SensitiveOperationPolicy,
  'enabled' | 'requiresStepUp' | 'requiresMakerChecker' | 'freshnessMinutes'
>;

type PendingProtectedAction =
  | { kind: 'policy'; operation: string; patch: PolicyPatch }
  | {
      kind: 'review';
      requestId: string;
      decision: 'approved' | 'rejected';
      feedback: string;
    };

function messageFrom(body: unknown, fallback: string): string {
  return typeof body === 'object' && body && 'error' in body
    ? String((body as { error: unknown }).error)
    : fallback;
}

export function PlatformSecurityGovernance() {
  const {
    data: policies,
    error: policiesError,
    mutate: mutatePolicies,
  } = useSWR<SensitiveOperationPolicy[]>(
    '/api/platform/security/step-up-policies',
  );
  const {
    data: requests,
    error: requestsError,
    mutate: mutateRequests,
  } = useSWR<SensitiveOperationChangeRequest[]>(
    '/api/platform/security/step-up-change-requests',
  );
  const [editing, setEditing] = React.useState<SensitiveOperationPolicy | null>(
    null,
  );
  const [editPatch, setEditPatch] = React.useState<PolicyPatch | null>(null);
  const [reviewing, setReviewing] = React.useState<{
    request: SensitiveOperationChangeRequest;
    decision: 'approved' | 'rejected';
  } | null>(null);
  const [feedback, setFeedback] = React.useState('');
  const [protectedAction, setProtectedAction] =
    React.useState<PendingProtectedAction | null>(null);
  const [stepUpOpen, setStepUpOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const grouped = React.useMemo(() => {
    const groups = new Map<string, SensitiveOperationPolicy[]>();
    for (const policy of policies ?? []) {
      const group = groups.get(policy.category) ?? [];
      group.push(policy);
      groups.set(policy.category, group);
    }
    return Array.from(groups.entries());
  }, [policies]);

  function openPolicy(policy: SensitiveOperationPolicy) {
    setEditing(policy);
    setEditPatch({
      enabled: policy.enabled,
      requiresStepUp: policy.requiresStepUp,
      requiresMakerChecker: policy.requiresMakerChecker,
      freshnessMinutes: policy.freshnessMinutes,
    });
    setError(null);
  }

  function queuePolicyUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !editPatch) return;
    if (
      editPatch.enabled &&
      !editPatch.requiresStepUp &&
      !editPatch.requiresMakerChecker
    ) {
      setError('An enabled rule needs at least one safeguard.');
      return;
    }
    setProtectedAction({
      kind: 'policy',
      operation: editing.operation,
      patch: editPatch,
    });
    setStepUpOpen(true);
  }

  function queueReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reviewing || feedback.trim().length < 3) return;
    setProtectedAction({
      kind: 'review',
      requestId: reviewing.request.id,
      decision: reviewing.decision,
      feedback: feedback.trim(),
    });
    setStepUpOpen(true);
  }

  function completeProtectedAction(stepUpChallengeId: string) {
    const action = protectedAction;
    setStepUpOpen(false);
    if (!action) return;

    startTransition(async () => {
      setError(null);
      const endpoint =
        action.kind === 'policy'
          ? `/api/platform/security/step-up-policies/${encodeURIComponent(action.operation)}`
          : `/api/platform/security/step-up-change-requests/${action.requestId}`;
      const body =
        action.kind === 'policy'
          ? { ...action.patch, stepUpChallengeId }
          : {
              decision: action.decision,
              feedback: action.feedback,
              stepUpChallengeId,
            };
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          messageFrom(responseBody, 'Could not save this security decision.'),
        );
        return;
      }

      if (action.kind === 'policy') {
        await mutatePolicies();
        setEditing(null);
        setEditPatch(null);
        setNotice('Sensitive-action policy updated.');
      } else {
        await Promise.all([mutateRequests(), mutatePolicies()]);
        setReviewing(null);
        setFeedback('');
        setNotice(`Change request ${action.decision}.`);
      }
      setProtectedAction(null);
    });
  }

  const loadError = policiesError ?? requestsError;

  return (
    <div className="space-y-5">
      {loadError || error ? (
        <NoticeBanner
          tone="destructive"
          role="alert"
          title={
            error ??
            (loadError instanceof Error
              ? loadError.message
              : 'Could not load security governance.')
          }
          onDismiss={error ? () => setError(null) : undefined}
        />
      ) : null}
      {notice ? (
        <NoticeBanner
          tone="success"
          title={notice}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" /> Sensitive-action
            catalog
          </CardTitle>
          <CardDescription>
            This is the authoritative protection map used by API guards. Every
            edit requires fresh identity confirmation and is audit logged.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-7">
          {grouped.map(([category, categoryPolicies]) => (
            <section key={category} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {SECURITY_CATEGORY_LABELS[
                  category as SensitiveOperationPolicy['category']
                ] ?? category}
              </h3>
              <div className="divide-y divide-border rounded-2xl border border-border">
                {categoryPolicies.map((policy) => (
                  <div
                    key={policy.operation}
                    className="grid gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_auto_auto] xl:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold">{policy.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {policy.description}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {policy.operation}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={policy.enabled ? 'default' : 'outline'}>
                        {policy.enabled ? 'Active' : 'Paused'}
                      </Badge>
                      {policy.requiresStepUp ? (
                        <Badge variant="secondary">
                          Step-up · {policy.freshnessMinutes}m
                        </Badge>
                      ) : null}
                      {policy.requiresMakerChecker ? (
                        <Badge variant="secondary">Maker-checker</Badge>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openPolicy(policy)}
                    >
                      <SlidersHorizontal className="size-4" /> Edit
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitPullRequest className="size-4 text-primary" /> Tenant requests
          </CardTitle>
          <CardDescription>
            Review the school’s context, then accept or reject with feedback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(requests ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tenant change requests.
            </p>
          ) : (
            requests?.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {request.tenant?.name ?? request.tenantId}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {request.operation}
                    </p>
                  </div>
                  <Badge
                    variant={
                      request.status === 'approved'
                        ? 'default'
                        : request.status === 'rejected'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {request.status}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {request.reason}
                </p>
                {request.feedback ? (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
                    Feedback: {request.feedback}
                  </p>
                ) : null}
                {request.status === 'pending' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setReviewing({ request, decision: 'approved' });
                        setFeedback('');
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReviewing({ request, decision: 'rejected' });
                        setFeedback('');
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Drawer
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DrawerContent className="mx-auto max-w-xl">
          <DrawerHeader>
            <DrawerTitle>{editing?.label}</DrawerTitle>
            <DrawerDescription>
              Configure the safeguards enforced for this operation.
            </DrawerDescription>
          </DrawerHeader>
          {editPatch ? (
            <form className="space-y-5 px-4" onSubmit={queuePolicyUpdate}>
              <label className="flex items-center gap-3 text-sm font-medium">
                <Checkbox
                  checked={editPatch.enabled}
                  onCheckedChange={(checked) =>
                    setEditPatch((current) =>
                      current
                        ? { ...current, enabled: checked === true }
                        : current,
                    )
                  }
                />
                Rule enabled
              </label>
              <label className="flex items-center gap-3 text-sm font-medium">
                <Checkbox
                  checked={editPatch.requiresStepUp}
                  onCheckedChange={(checked) =>
                    setEditPatch((current) =>
                      current
                        ? { ...current, requiresStepUp: checked === true }
                        : current,
                    )
                  }
                />
                Fresh identity confirmation
              </label>
              <label className="flex items-center gap-3 text-sm font-medium">
                <Checkbox
                  checked={editPatch.requiresMakerChecker}
                  onCheckedChange={(checked) =>
                    setEditPatch((current) =>
                      current
                        ? {
                            ...current,
                            requiresMakerChecker: checked === true,
                          }
                        : current,
                    )
                  }
                />
                Second-person approval
              </label>
              <div className="space-y-2">
                <Label htmlFor="platform-freshness">
                  Confirmation freshness (minutes)
                </Label>
                <Input
                  id="platform-freshness"
                  type="number"
                  min={1}
                  max={30}
                  value={editPatch.freshnessMinutes}
                  onChange={(event) =>
                    setEditPatch((current) =>
                      current
                        ? {
                            ...current,
                            freshnessMinutes: Number(event.target.value),
                          }
                        : current,
                    )
                  }
                />
              </div>
              <DrawerFooter className="px-0">
                <Button type="submit" disabled={isPending}>
                  Review and save
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
              </DrawerFooter>
            </form>
          ) : null}
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(reviewing)}
        onOpenChange={(open) => {
          if (!open) setReviewing(null);
        }}
      >
        <DrawerContent className="mx-auto max-w-xl">
          <DrawerHeader>
            <DrawerTitle>
              {reviewing?.decision === 'approved' ? 'Approve' : 'Reject'} change
              request
            </DrawerTitle>
            <DrawerDescription>
              Your feedback is visible to {reviewing?.request.tenant?.name}.
            </DrawerDescription>
          </DrawerHeader>
          <form className="space-y-4 px-4" onSubmit={queueReview}>
            <div className="space-y-2">
              <Label htmlFor="platform-feedback">Decision feedback</Label>
              <Textarea
                id="platform-feedback"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                minLength={3}
                maxLength={1000}
                required
              />
            </div>
            <DrawerFooter className="px-0">
              <Button type="submit" disabled={isPending || feedback.length < 3}>
                Confirm decision
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setReviewing(null)}
              >
                Cancel
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      <StepUpPrompt
        open={stepUpOpen}
        operation={STEP_UP_OPERATION.SECURITY_POLICY_UPDATE}
        title="Confirm platform security change"
        description="This decision changes an authoritative security safeguard and will be audit logged."
        onCancel={() => {
          setStepUpOpen(false);
          setProtectedAction(null);
        }}
        onVerified={completeProtectedAction}
      />
    </div>
  );
}
