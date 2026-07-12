'use client';

/* ============================================================
   AiSettingsClient — propose + approve AI settings changes

   Changes to a tenant's AI settings run through maker-checker:
   this surface submits a proposal (POST change-request) and lists
   pending proposals for a *different* admin to approve or reject.
   The current (already-applied) settings are rendered server-side
   on the parent page; this island only handles mutation.
   ============================================================ */

import * as React from 'react';
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
import { Toggle } from '@workspace/ui/components/toggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';

export interface AiSettings {
  modelTier: string;
  analyticsEnabled: boolean;
  tutorEnabled: boolean;
  monthlyTokenBudget: number;
  concurrencyLimit: number;
  alertThresholdPercent: number;
  byokProvider: string | null;
  keyLast4: string | null;
}

export interface PendingChange {
  id: string;
  makerId: string;
  makerClearanceLevel: number;
  changes: Record<string, unknown>;
  createdAt: string;
  expiresAt: string | null;
}

interface Props {
  settings: AiSettings;
  pending: PendingChange[];
}

const PLATFORM_KEY = '__platform__';

export function AiSettingsClient({ settings, pending }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const [modelTier, setModelTier] = React.useState(settings.modelTier);
  const [analyticsEnabled, setAnalyticsEnabled] = React.useState(
    settings.analyticsEnabled,
  );
  const [tutorEnabled, setTutorEnabled] = React.useState(settings.tutorEnabled);
  const [monthlyTokenBudget, setMonthlyTokenBudget] = React.useState(
    String(settings.monthlyTokenBudget),
  );
  const [concurrencyLimit, setConcurrencyLimit] = React.useState(
    String(settings.concurrencyLimit),
  );
  const [alertThresholdPercent, setAlertThresholdPercent] = React.useState(
    String(settings.alertThresholdPercent),
  );
  const [byokProvider, setByokProvider] = React.useState(
    settings.byokProvider ?? PLATFORM_KEY,
  );
  const [byokApiKey, setByokApiKey] = React.useState('');

  /** Only send fields that differ from the applied settings. */
  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    if (modelTier !== settings.modelTier) payload.modelTier = modelTier;
    if (analyticsEnabled !== settings.analyticsEnabled)
      payload.analyticsEnabled = analyticsEnabled;
    if (tutorEnabled !== settings.tutorEnabled)
      payload.tutorEnabled = tutorEnabled;
    const budget = Number(monthlyTokenBudget);
    if (Number.isFinite(budget) && budget !== settings.monthlyTokenBudget)
      payload.monthlyTokenBudget = budget;
    const concurrency = Number(concurrencyLimit);
    if (Number.isFinite(concurrency) && concurrency !== settings.concurrencyLimit)
      payload.concurrencyLimit = concurrency;
    const threshold = Number(alertThresholdPercent);
    if (
      Number.isFinite(threshold) &&
      threshold !== settings.alertThresholdPercent
    )
      payload.alertThresholdPercent = threshold;

    const currentProvider = settings.byokProvider ?? PLATFORM_KEY;
    if (byokProvider === PLATFORM_KEY && currentProvider !== PLATFORM_KEY) {
      payload.byokProvider = null; // clear BYOK
    } else if (byokProvider !== PLATFORM_KEY && byokApiKey) {
      payload.byokProvider = byokProvider;
      payload.byokApiKey = byokApiKey;
    }
    return payload;
  }

  async function submit() {
    setError(null);
    setNotice(null);
    const payload = buildPayload();
    if (byokProvider !== PLATFORM_KEY && !byokApiKey && !settings.byokProvider) {
      setError('Enter the BYOK API key to switch to a bring-your-own-key provider.');
      return;
    }
    if (Object.keys(payload).length === 0) {
      setError('No changes to propose.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/ai/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Could not submit the change.');
      }
      setByokApiKey('');
      setNotice('Change submitted — a different admin must approve it before it applies.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the change.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(id: string, decision: 'approve' | 'reject') {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/ai/admin/settings/change-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: decision === 'reject' ? 'Rejected via settings' : undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Could not ${decision} the change.`);
      }
      setNotice(decision === 'approve' ? 'Change approved and applied.' : 'Change rejected.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${decision} the change.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {pending.length > 0 ? (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Pending changes</CardTitle>
            <CardDescription>
              Awaiting approval by an admin other than the requester (dual control).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {pending.map((change) => (
              <div
                key={change.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(change.changes).map(([key, value]) => (
                      <StatusBadge key={key} tone="info">
                        {key}: {String(value)}
                      </StatusBadge>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Requested by {change.makerId.slice(0, 8)}… ·{' '}
                    {new Date(change.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void decide(change.id, 'reject')}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void decide(change.id, 'approve')}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Propose a settings change</CardTitle>
          <CardDescription>
            Changes go through maker-checker approval before they take effect.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <NoticeBanner tone="destructive" role="alert" title={error} onDismiss={() => setError(null)} />
          ) : null}
          {notice ? (
            <NoticeBanner tone="success" title={notice} onDismiss={() => setNotice(null)} />
          ) : null}

          <div className="grid gap-4 @xl/main:grid-cols-2">
            <Field label="Model tier">
              <Select value={modelTier} onValueChange={setModelTier}>
                <SelectTrigger aria-label="Model tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="BYOK provider">
              <Select
                value={byokProvider}
                onValueChange={(v) => {
                  setByokProvider(v);
                  if (v === PLATFORM_KEY) setByokApiKey('');
                }}
              >
                <SelectTrigger aria-label="BYOK provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PLATFORM_KEY}>Platform key</SelectItem>
                  <SelectItem value="anthropic">Anthropic (BYOK)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {byokProvider !== PLATFORM_KEY ? (
              <Field label="BYOK API key" hint={settings.keyLast4 ? `Current: …${settings.keyLast4}` : undefined}>
                <Input
                  type="password"
                  value={byokApiKey}
                  onChange={(e) => setByokApiKey(e.target.value)}
                  placeholder="sk-…"
                  autoComplete="off"
                />
              </Field>
            ) : null}

            <Field label="Monthly token budget">
              <Input
                type="number"
                min={0}
                value={monthlyTokenBudget}
                onChange={(e) => setMonthlyTokenBudget(e.target.value)}
              />
            </Field>

            <Field label="Concurrency limit">
              <Input
                type="number"
                min={1}
                value={concurrencyLimit}
                onChange={(e) => setConcurrencyLimit(e.target.value)}
              />
            </Field>

            <Field label="Alert threshold (%)">
              <Input
                type="number"
                min={1}
                max={100}
                value={alertThresholdPercent}
                onChange={(e) => setAlertThresholdPercent(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <ToggleRow
              label="Analytics chat"
              on={analyticsEnabled}
              onChange={setAnalyticsEnabled}
            />
            <ToggleRow
              label="Study tutor"
              on={tutorEnabled}
              onChange={setTutorEnabled}
            />
          </div>

          <div className="flex justify-end">
            <Button size="sm" disabled={busy} onClick={() => void submit()}>
              Submit for approval
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function ToggleRow({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Toggle
        variant="outline"
        size="sm"
        pressed={on}
        onPressedChange={onChange}
        aria-label={`${label} ${on ? 'enabled' : 'disabled'}`}
        className="data-[state=on]:bg-success/15 data-[state=on]:text-success"
      >
        {on ? 'On' : 'Off'}
      </Toggle>
      <span className="text-sm text-foreground">{label}</span>
    </div>
  );
}
