'use client';

/* ============================================================
   /settings/branding — logo, colours, theme

   The Branding panel: logo slot, a brand-colour picker (preset
   swatches), and a default-theme choice. This is the tenant-facing
   surface for the brandable colour roles (see the UI README's
   tenant-branding contract). Mock state; persistence lands with the
   API. Interactive selection is local useState.
   ============================================================ */

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

const SWATCHES = [
  { key: 'blurple', value: '#4f6df5' },
  { key: 'violet', value: '#7c5cff' },
  { key: 'emerald', value: '#0fa968' },
  { key: 'rose', value: '#e5484d' },
  { key: 'amber', value: '#f5a623' },
  { key: 'slate', value: '#5b6577' },
];

export default function BrandingSettingsPage() {
  const [color, setColor] = React.useState(SWATCHES[0]!.key);
  const [theme, setTheme] = React.useState('system');

  return (
    <div className="flex flex-col gap-5">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Brand identity</CardTitle>
          <CardDescription>
            Your logo and primary colour appear in the app shell and on
            documents.
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
                PNG or SVG, at least 256×256px.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-sm font-medium text-foreground">
              Primary colour
            </span>
            <div className="flex flex-wrap gap-2.5">
              {SWATCHES.map((s) => {
                const selected = s.key === color;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setColor(s.key)}
                    aria-label={s.key}
                    aria-pressed={selected}
                    style={{ backgroundColor: s.value }}
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
            The theme new users start with; they can still switch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            variant="outline"
            value={theme}
            onValueChange={(v) => {
              if (v) setTheme(v);
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
