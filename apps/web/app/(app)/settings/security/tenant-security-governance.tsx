'use client';

import * as React from 'react';
import {
  Fingerprint,
  GitPullRequest,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';

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
  type BiometricEnrollmentPolicy,
  type SensitiveOperationChangeRequest,
  type SensitiveOperationPolicy,
} from '@/lib/security-governance';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { StepUpPrompt } from '../../_shared/step-up-prompt';

const ENROLLMENT_OPTIONS: Array<{
  value: BiometricEnrollmentPolicy;
  label: string;
  description: string;
}> = [
  {
    value: 'require',
    label: 'Require',
    description: 'Prompt people to enrol and protect their last passkey.',
  },
  {
    value: 'allow',
    label: 'Allow',
    description: 'Make biometric sign-in optional for every account.',
  },
  {
    value: 'forbid',
    label: 'Forbid',
    description: 'Block new biometric enrolment for this school.',
  },
];

function readError(body: unknown, fallback: string): string {
  return typeof body === 'object' && body && 'error' in body
    ? String((body as { error: unknown }).error)
    : fallback;
}

function PolicyBadges({ policy }: { policy: SensitiveOperationPolicy }) {
  if (!policy.enabled) return <Badge variant="outline">Paused</Badge>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {policy.requiresStepUp ? <Badge>Fresh confirmation</Badge> : null}
      {policy.requiresMakerChecker ? (
        <Badge variant="secondary">Second approver</Badge>
      ) : null}
      {policy.requiresStepUp ? (
        <Badge variant="outline">{policy.freshnessMinutes} min</Badge>
      ) : null}
    </div>
  );
}

export function TenantSecurityGovernance({
  initialEnrollmentPolicy,
  policies,
  initialRequests,
  canEdit,
}: {
  initialEnrollmentPolicy: BiometricEnrollmentPolicy;
  policies: SensitiveOperationPolicy[];
  initialRequests: SensitiveOperationChangeRequest[];
  canEdit: boolean;
}) {
  const [savedEnrollment, setSavedEnrollment] = React.useState(
    initialEnrollmentPolicy,
  );
  const [enrollment, setEnrollment] = React.useState(initialEnrollmentPolicy);
  const [requests, setRequests] = React.useState(initialRequests);
  const [requestPolicy, setRequestPolicy] =
    React.useState<SensitiveOperationPolicy | null>(null);
  const [requestedEnabled, setRequestedEnabled] = React.useState(true);
  const [requestedStepUp, setRequestedStepUp] = React.useState(true);
  const [requestedMakerChecker, setRequestedMakerChecker] =
    React.useState(false);
  const [requestedFreshness, setRequestedFreshness] = React.useState(5);
  const [reason, setReason] = React.useState('');
  const [stepUpOpen, setStepUpOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const grouped = React.useMemo(() => {
    const groups = new Map<
      SensitiveOperationPolicy['category'],
      SensitiveOperationPolicy[]
    >();
    for (const policy of policies) {
      const group = groups.get(policy.category) ?? [];
      group.push(policy);
      groups.set(policy.category, group);
    }
    return Array.from(groups.entries());
  }, [policies]);

  function openRequest(policy: SensitiveOperationPolicy) {
    setRequestPolicy(policy);
    setRequestedEnabled(policy.enabled);
    setRequestedStepUp(policy.requiresStepUp);
    setRequestedMakerChecker(policy.requiresMakerChecker);
    setRequestedFreshness(policy.freshnessMinutes);
    setReason('');
    setError(null);
  }

  function saveEnrollment(stepUpChallengeId: string) {
    startTransition(async () => {
      setError(null);
      const response = await fetch('/api/settings/security/biometrics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy: enrollment,
          stepUpChallengeId,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(readError(body, 'Could not save biometric policy.'));
        return;
      }
      setSavedEnrollment(enrollment);
      setNotice('Biometric enrolment policy saved.');
    });
  }

  function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requestPolicy) return;

    const changes: Record<string, boolean | number> = {};
    if (requestedEnabled !== requestPolicy.enabled)
      changes.enabled = requestedEnabled;
    if (requestedStepUp !== requestPolicy.requiresStepUp)
      changes.requiresStepUp = requestedStepUp;
    if (requestedMakerChecker !== requestPolicy.requiresMakerChecker)
      changes.requiresMakerChecker = requestedMakerChecker;
    if (requestedFreshness !== requestPolicy.freshnessMinutes)
      changes.freshnessMinutes = requestedFreshness;

    if (Object.keys(changes).length === 0) {
      setError('Choose at least one policy change before sending a request.');
      return;
    }

    startTransition(async () => {
      setError(null);
      const response = await fetch(
        '/api/settings/security/step-up-change-requests',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: requestPolicy.operation,
            reason,
            ...changes,
          }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(readError(body, 'Could not send this change request.'));
        return;
      }
      setRequests((current) => [
        body as SensitiveOperationChangeRequest,
        ...current,
      ]);
      setRequestPolicy(null);
      setNotice('Change request sent to platform security.');
    });
  }

  return (
    <div className="space-y-5">
      {error ? (
        <NoticeBanner
          tone="destructive"
          role="alert"
          title={error}
          onDismiss={() => setError(null)}
        />
      ) : null}
      {notice ? (
        <NoticeBanner
          tone="success"
          title={notice}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      <Card className="overflow-hidden shadow-card">
        <CardHeader className="border-b border-border bg-primary/[0.035]">
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint className="size-4 text-primary" /> Biometric enrolment
          </CardTitle>
          <CardDescription>
            Decide whether people at this school must, may, or cannot add Face
            ID, Touch ID, Windows Hello, and Android passkeys.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-3">
          {ENROLLMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={!canEdit || isPending}
              onClick={() => setEnrollment(option.value)}
              className={`rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                enrollment === option.value
                  ? 'border-primary bg-primary/[0.06]'
                  : 'border-border hover:border-primary/35'
              }`}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {option.description}
              </span>
            </button>
          ))}
          <div className="flex justify-end md:col-span-3">
            <Button
              disabled={!canEdit || enrollment === savedEnrollment || isPending}
              onClick={() => setStepUpOpen(true)}
            >
              Save enrolment policy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" /> Sensitive-action map
          </CardTitle>
          <CardDescription>
            Platform security owns these safeguards. Your school can inspect
            every rule and request a reviewed change.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-7">
          {grouped.map(([category, categoryPolicies]) => (
            <section key={category} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {SECURITY_CATEGORY_LABELS[category]}
              </h3>
              <div className="divide-y divide-border rounded-2xl border border-border">
                {categoryPolicies.map((policy) => (
                  <div
                    key={policy.operation}
                    className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
                  >
                    <div>
                      <p className="text-sm font-semibold">{policy.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {policy.description}
                      </p>
                    </div>
                    <PolicyBadges policy={policy} />
                    {canEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRequest(policy)}
                      >
                        <GitPullRequest className="size-4" /> Request change
                      </Button>
                    ) : null}
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
            <GitPullRequest className="size-4 text-primary" /> Change requests
          </CardTitle>
          <CardDescription>
            Platform decisions and feedback stay visible here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No policy changes requested yet.
            </p>
          ) : (
            requests.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{request.operation}</p>
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
                <p className="mt-2 text-sm text-muted-foreground">
                  {request.reason}
                </p>
                {request.feedback ? (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
                    Platform feedback: {request.feedback}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Drawer
        open={Boolean(requestPolicy)}
        onOpenChange={(open) => {
          if (!open) setRequestPolicy(null);
        }}
      >
        <DrawerContent className="mx-auto max-w-xl">
          <DrawerHeader>
            <DrawerTitle>Request a safeguard change</DrawerTitle>
            <DrawerDescription>
              {requestPolicy?.label}. Explain the school need so platform
              security can make an informed decision.
            </DrawerDescription>
          </DrawerHeader>
          <form className="space-y-5 px-4" onSubmit={submitRequest}>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={requestedEnabled}
                onCheckedChange={(checked) =>
                  setRequestedEnabled(checked === true)
                }
              />
              <span>
                <span className="font-medium">Rule enabled</span>
                <span className="block text-xs text-muted-foreground">
                  Pausing a rule removes its configured safeguard.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={requestedStepUp}
                onCheckedChange={(checked) =>
                  setRequestedStepUp(checked === true)
                }
              />
              <span className="font-medium">Fresh identity confirmation</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={requestedMakerChecker}
                onCheckedChange={(checked) =>
                  setRequestedMakerChecker(checked === true)
                }
              />
              <span className="font-medium">Second-person approval</span>
            </label>
            <div className="space-y-2">
              <Label htmlFor="requested-freshness">
                Confirmation freshness (minutes)
              </Label>
              <div className="flex items-center gap-3">
                <TimerReset className="size-4 text-muted-foreground" />
                <Input
                  id="requested-freshness"
                  type="number"
                  min={1}
                  max={30}
                  value={requestedFreshness}
                  onChange={(event) =>
                    setRequestedFreshness(Number(event.target.value))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="change-reason">Reason</Label>
              <Textarea
                id="change-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={10}
                maxLength={1000}
                required
                placeholder="Describe the operational or compliance need."
              />
            </div>
            <DrawerFooter className="px-0">
              <Button type="submit" disabled={isPending || reason.length < 10}>
                {isPending ? 'Sending…' : 'Send request'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRequestPolicy(null)}
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
        title="Confirm this enrolment policy"
        description="This changes how biometric sign-in is offered across the school."
        onCancel={() => setStepUpOpen(false)}
        onVerified={(challengeId) => {
          setStepUpOpen(false);
          saveEnrollment(challengeId);
        }}
      />
    </div>
  );
}
