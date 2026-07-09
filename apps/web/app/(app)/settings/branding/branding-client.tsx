'use client';

import * as React from 'react';
import { Check, GraduationCap, Upload } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@workspace/ui/components/toggle-group';
import { cn } from '@workspace/ui/lib/utils';

interface Props {
  initialColor?: string;
  initialTheme?: string;
}

const SWATCHES = [
  { key: '#4f6df5', label: 'Blue' },
  { key: '#0fa968', label: 'Green' },
  { key: '#e5484d', label: 'Red' },
  { key: '#f5a623', label: 'Amber' },
  { key: '#5b6577', label: 'Slate' },
];

export function BrandingSettingsClient({ initialColor, initialTheme }: Props) {
  const [color, setColor] = React.useState(initialColor ?? '');
  const [theme, setTheme] = React.useState(initialTheme ?? 'system');

  return (
    <div className="flex flex-col gap-5">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Brand identity</CardTitle>
          <CardDescription>
            Values are initialized from tenant configuration when present.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <div
              aria-hidden
              className="grid size-16 shrink-0 place-items-center rounded-[var(--radius)] border border-border bg-muted text-muted-foreground"
            >
              <GraduationCap className="size-7" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" size="sm">
                <Upload /> Upload logo
              </Button>
              <p className="text-xs text-muted-foreground">
                PNG or SVG, at least 256x256px.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-medium text-foreground">
              Primary colour
            </span>
            <div className="flex flex-wrap gap-2.5">
              {SWATCHES.map((swatch) => {
                const selected = swatch.key === color;
                return (
                  <button
                    key={swatch.key}
                    type="button"
                    onClick={() => setColor(swatch.key)}
                    aria-label={swatch.label}
                    aria-pressed={selected}
                    style={{ backgroundColor: swatch.key }}
                    className={cn(
                      'grid size-9 place-items-center rounded-full outline-none transition-transform',
                      'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      selected
                        ? 'ring-2 ring-ring ring-offset-2 ring-offset-card'
                        : 'hover:scale-105',
                    )}
                  >
                    {selected ? (
                      <Check className="size-4 text-white" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Default theme</CardTitle>
          <CardDescription>
            The theme new users start with when tenant configuration defines one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            variant="outline"
            value={theme}
            onValueChange={(value) => {
              if (value) setTheme(value);
            }}
            className="justify-start"
          >
            <ToggleGroupItem value="light" className="px-4">
              Light
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="px-4">
              Dark
            </ToggleGroupItem>
            <ToggleGroupItem value="system" className="px-4">
              System
            </ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2.5">
        <Button variant="outline" size="sm">
          Reset
        </Button>
        <Button size="sm">Save branding</Button>
      </div>
    </div>
  );
}
