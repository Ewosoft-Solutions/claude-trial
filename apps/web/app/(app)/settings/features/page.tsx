'use client';

/* ============================================================
   /settings/features — module toggles

   Enable/disable optional product modules. Each row pairs a
   description with a Toggle (pressed = enabled) on the shared Toggle
   primitive. Mock state via useState; persistence lands with the API.
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

interface Feature {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  defaultOn: boolean;
}

const FEATURES: Feature[] = [
  { key: 'messaging', label: 'Messaging', description: 'Internal messaging between staff, students and parents.', icon: <MessagesSquare className="size-4" />, defaultOn: true },
  { key: 'transport', label: 'Transport', description: 'Route planning and bus assignment for students.', icon: <Bus className="size-4" />, defaultOn: true },
  { key: 'cafeteria', label: 'Cafeteria', description: 'Meal ordering and pre-payment.', icon: <UtensilsCrossed className="size-4" />, defaultOn: false },
  { key: 'library', label: 'Library', description: 'Catalog, lending and returns.', icon: <Library className="size-4" />, defaultOn: false },
  { key: 'health', label: 'Health records', description: 'Medical information and immunisation tracking.', icon: <HeartPulse className="size-4" />, defaultOn: true },
];

export default function FeaturesSettingsPage() {
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(FEATURES.map((f) => [f.key, f.defaultOn])),
  );

  const onCount = Object.values(enabled).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Modules</CardTitle>
          <CardDescription>
            {onCount} of {FEATURES.length} modules enabled for St. Jude Academy.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          {FEATURES.map((f, i) => {
            const on = enabled[f.key] ?? false;
            return (
              <div
                key={f.key}
                className={
                  'flex items-center gap-3 py-3.5' +
                  (i > 0 ? ' border-t border-border' : '')
                }
              >
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
                >
                  {f.icon}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {f.label}
                  </span>
                  <span className="text-xs text-muted-foreground text-pretty">
                    {f.description}
                  </span>
                </div>
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={on}
                  onPressedChange={(v) =>
                    setEnabled((prev) => ({ ...prev, [f.key]: v }))
                  }
                  aria-label={`${f.label} ${on ? 'enabled' : 'disabled'}`}
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
        <Button size="sm">Save modules</Button>
      </div>
    </div>
  );
}
