'use client';

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

const FEATURES: Feature[] = [
  { key: 'messaging', label: 'Messaging', description: 'Internal messaging between staff, students and parents.', icon: <MessagesSquare className="size-4" /> },
  { key: 'transport', label: 'Transport', description: 'Route planning and bus assignment for students.', icon: <Bus className="size-4" /> },
  { key: 'cafeteria', label: 'Cafeteria', description: 'Meal ordering and pre-payment.', icon: <UtensilsCrossed className="size-4" /> },
  { key: 'library', label: 'Library', description: 'Catalog, lending and returns.', icon: <Library className="size-4" /> },
  { key: 'health', label: 'Health records', description: 'Medical information and immunisation tracking.', icon: <HeartPulse className="size-4" /> },
];

export function FeaturesSettingsClient({ initialEnabled, schoolName }: Props) {
  const [enabled, setEnabled] = React.useState<Record<string, boolean>>(initialEnabled);
  const onCount = FEATURES.filter((feature) => enabled[feature.key]).length;

  return (
    <div className="flex flex-col gap-5">
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
        <Button size="sm">Save modules</Button>
      </div>
    </div>
  );
}
