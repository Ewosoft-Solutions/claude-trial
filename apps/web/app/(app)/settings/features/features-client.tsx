'use client';

/* ============================================================
   FeaturesSettingsClient — per-tenant module toggles

   Reads the current feature map (server-fetched) and persists
   changes via PATCH /api/tenant/features. These toggles gate the
   role/schoolType-aware navigation (see canAccess `features`), so
   turning a module off hides its section for everyone in the school.
   ============================================================ */

import * as React from 'react';
import {
  Bus,
  HeartPulse,
  Library,
  MessagesSquare,
  UtensilsCrossed,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Toggle } from '@workspace/ui/components/toggle';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';

interface Props {
  initialEnabled: Record<string, boolean>;
  schoolName?: string;
}

interface Feature {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

/** Must mirror FEATURE_KEYS (packages/ui access.types + api tenant-features). */
const FEATURES: Feature[] = [
  { key: 'messaging', label: 'Messaging', description: 'Internal messaging between staff, students and parents.', icon: <MessagesSquare className="size-4" /> },
  { key: 'transport', label: 'Transport', description: 'Route planning and bus assignment for students.', icon: <Bus className="size-4" /> },
  { key: 'cafeteria', label: 'Cafeteria', description: 'Meal ordering and pre-payment.', icon: <UtensilsCrossed className="size-4" /> },
  { key: 'library', label: 'Library', description: 'Catalog, lending and returns.', icon: <Library className="size-4" /> },
  { key: 'health', label: 'Health records', description: 'Medical information and immunisation tracking.', icon: <HeartPulse className="size-4" /> },
];

/** A feature is on unless explicitly stored false (default-on). */
function isOn(map: Record<string, boolean>, key: string): boolean {
  return map[key] !== false;
}

export function FeaturesSettingsClient({ initialEnabled, schoolName }: Props) {
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURES.map((f) => [f.key, isOn(initialEnabled, f.key)])),
  );
  const [saved, setSaved] = React.useState(enabled);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const onCount = FEATURES.filter((f) => enabled[f.key]).length;
  const dirty = FEATURES.some((f) => enabled[f.key] !== saved[f.key]);

  async function save() {
    setBusy(true);
    setError(null);
    setNotice(null);
    // Send only the changed keys.
    const patch: Record<string, boolean> = {};
    for (const f of FEATURES) {
      if (enabled[f.key] !== saved[f.key]) patch[f.key] = enabled[f.key]!;
    }
    try {
      const res = await fetch('/api/tenant/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: patch }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Could not save modules.');
      }
      setSaved(enabled);
      setNotice('Modules saved. Navigation updates on next sign-in or reload.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save modules.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <NoticeBanner tone="destructive" role="alert" title={error} onDismiss={() => setError(null)} />
      ) : null}
      {notice ? (
        <NoticeBanner tone="success" title={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Modules</CardTitle>
          <CardDescription>
            {onCount} of {FEATURES.length} modules enabled
            {schoolName ? ` for ${schoolName}` : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {FEATURES.map((feature, index) => {
            const on = enabled[feature.key] ?? false;
            return (
              <div
                key={feature.key}
                className={
                  'flex items-center gap-3 py-3.5' +
                  (index > 0 ? ' border-t border-border' : '')
                }
              >
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
                >
                  {feature.icon}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {feature.label}
                  </span>
                  <span className="text-xs text-muted-foreground text-pretty">
                    {feature.description}
                  </span>
                </div>
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={on}
                  onPressedChange={(value) =>
                    setEnabled((prev) => ({ ...prev, [feature.key]: value }))
                  }
                  aria-label={`${feature.label} ${on ? 'enabled' : 'disabled'}`}
                  className="shrink-0 data-[state=on]:bg-success/15 data-[state=on]:text-success"
                >
                  {on ? 'On' : 'Off'}
                </Toggle>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button size="sm" disabled={busy || !dirty} onClick={() => void save()}>
          Save modules
        </Button>
      </div>
    </div>
  );
}
