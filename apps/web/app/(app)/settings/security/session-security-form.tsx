'use client';

import * as React from 'react';
import { Clock3, MonitorPlay, ShieldCheck } from 'lucide-react';
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
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';

import type { SessionLifecyclePolicy } from '@/lib/session';
import { STEP_UP_OPERATION } from '@/lib/step-up';
import { StepUpPrompt } from '../../_shared/step-up-prompt';

export function SessionSecurityForm({
  initialPolicy,
  endpoint,
  canEdit,
  tenantName,
}: {
  initialPolicy: SessionLifecyclePolicy;
  endpoint: string;
  canEdit: boolean;
  tenantName?: string;
}) {
  const router = useRouter();
  const [savedValue, setSavedValue] = React.useState(
    initialPolicy.idleTimeoutMinutes,
  );
  const [value, setValue] = React.useState(initialPolicy.idleTimeoutMinutes);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [stepUpOpen, setStepUpOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const dirty = value !== savedValue;

  function save(stepUpChallengeId: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idleTimeoutMinutes: value, stepUpChallengeId }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        idleTimeoutMinutes?: number;
      };
      if (!response.ok) {
        setError(body.error ?? 'Could not save the inactivity policy.');
        return;
      }
      const next = body.idleTimeoutMinutes ?? value;
      setSavedValue(next);
      setValue(next);
      setNotice(
        'Inactivity policy saved. This session now uses the new limit.',
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
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
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">Inactivity protection</CardTitle>
              <CardDescription>
                Choose when an unattended session begins its sign-out warning
                {tenantName ? ` for ${tenantName}` : ''}.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="space-y-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <label htmlFor="idle-timeout" className="text-sm font-semibold">
                  Sign out after
                </label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Real keyboard, pointer, scrolling and approved media activity
                  reset this timer.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="idle-timeout"
                  type="number"
                  min={initialPolicy.minimumIdleTimeoutMinutes}
                  max={initialPolicy.maximumIdleTimeoutMinutes}
                  value={value}
                  disabled={!canEdit || isPending}
                  onChange={(event) => setValue(Number(event.target.value))}
                  className="w-20 text-right font-mono tabular-nums"
                />
                <span className="text-sm text-muted-foreground">minutes</span>
              </div>
            </div>
            <input
              type="range"
              min={initialPolicy.minimumIdleTimeoutMinutes}
              max={initialPolicy.maximumIdleTimeoutMinutes}
              step={1}
              value={value}
              disabled={!canEdit || isPending}
              onChange={(event) => setValue(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Inactivity timeout in minutes"
            />
            <div className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>{initialPolicy.minimumIdleTimeoutMinutes} min</span>
              <span>{initialPolicy.maximumIdleTimeoutMinutes} min</span>
            </div>
          </div>

          <div className="grid place-items-center rounded-2xl border border-primary/15 bg-primary/[0.045] p-5 text-center">
            <Clock3 className="size-5 text-primary" />
            <div className="mt-2 font-mono text-4xl font-semibold tabular-nums text-foreground">
              {value}
            </div>
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              idle minutes
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Warning windows</CardTitle>
          <CardDescription>
            Long-work screens receive extra time to protect thoughtful work.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <Clock3 className="size-4 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Standard screens</p>
            <p className="mt-1 font-mono text-2xl tabular-nums">
              {Math.round(initialPolicy.standardWarningSeconds / 60)} min
            </p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/[0.025] p-4">
            <MonitorPlay className="size-4 text-primary" />
            <p className="mt-3 text-sm font-semibold">
              Tests, reading and media
            </p>
            <p className="mt-1 font-mono text-2xl tabular-nums">
              {Math.round(initialPolicy.focusWarningSeconds / 60)} min
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button
          disabled={!canEdit || !dirty || isPending}
          onClick={() => setStepUpOpen(true)}
        >
          {isPending ? 'Saving…' : 'Save inactivity policy'}
        </Button>
      </div>

      <StepUpPrompt
        open={stepUpOpen}
        operation={STEP_UP_OPERATION.SECURITY_POLICY_UPDATE}
        title="Confirm this security change"
        description="Changing the inactivity policy affects every signed-in user at this school."
        onCancel={() => setStepUpOpen(false)}
        onVerified={(challengeId) => {
          setStepUpOpen(false);
          save(challengeId);
        }}
      />
    </div>
  );
}
