'use client';

import { useEffect, useState } from 'react';
import {
  Laptop,
  LayoutGrid,
  Minus,
  Moon,
  PanelLeft,
  Plus,
  Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { cn } from '@workspace/ui/lib/utils';

import { useMobileNavMode } from '@/app/providers/mobile-nav-provider';
import {
  DEFAULT_FONT_SCALE,
  FONT_SCALE_STEPS,
  normalizeFontScaleStep,
  readFontScalePreference,
  saveFontScalePreference,
} from '@/lib/font-scale';

const THEMES = [
  { value: 'system', label: 'System', icon: Laptop },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

const PHONE_MENU_OPTIONS = [
  {
    pinned: false,
    label: 'Bottom bar',
    icon: LayoutGrid,
    hint: 'Tabs along the bottom, everything else behind “More”.',
  },
  {
    pinned: true,
    label: 'Side menu',
    icon: PanelLeft,
    hint: 'The compact rail stays pinned; sub-menus open beside it.',
  },
] as const;

/**
 * The same choice offered from the phone drawer ("Pin menu to side") and the
 * pinned rail's profile menu ("Unpin menu") — mirrored here so a user who
 * cannot find it in the navigation itself has a settled place to look.
 */
function PhoneMenuControl() {
  const { pinned, setPinned } = useMobileNavMode();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {PHONE_MENU_OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = pinned === option.pinned;
        return (
          <Button
            key={option.label}
            type="button"
            variant="outline"
            onClick={() => setPinned(option.pinned)}
            aria-pressed={selected}
            className={cn(
              'h-auto flex-col items-start gap-1.5 px-4 py-4 text-left',
              selected && 'border-primary bg-primary/10 text-foreground',
            )}
          >
            <span className="flex items-center gap-3 font-semibold">
              <Icon className="size-5 shrink-0" aria-hidden />
              {option.label}
            </span>
            <span className="whitespace-normal text-sm font-normal text-muted-foreground">
              {option.hint}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

function TextSizeControl() {
  // The applied value lives on <html> (set first-paint from the cookie). Mirror
  // it into state on mount so the control reflects the current choice.
  const [scale, setScale] = useState(DEFAULT_FONT_SCALE);
  useEffect(() => setScale(readFontScalePreference()), []);

  const step = normalizeFontScaleStep(scale);
  const index = FONT_SCALE_STEPS.indexOf(step);
  const atMin = index <= 0;
  const atMax = index >= FONT_SCALE_STEPS.length - 1;

  function move(delta: number) {
    const next =
      FONT_SCALE_STEPS[
        Math.min(FONT_SCALE_STEPS.length - 1, Math.max(0, index + delta))
      ] ?? step;
    setScale(next.value);
    saveFontScalePreference(next.value); // applies live + cookie + account
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label="Text size"
        className="flex items-center gap-3"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => move(-1)}
          disabled={atMin}
          aria-label="Decrease text size"
        >
          <Minus />
        </Button>

        {/* Step meter */}
        <div className="flex flex-1 items-center gap-1.5" aria-hidden>
          {FONT_SCALE_STEPS.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= index ? 'bg-primary' : 'bg-border',
              )}
            />
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => move(1)}
          disabled={atMax}
          aria-label="Increase text size"
        >
          <Plus />
        </Button>
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">
        Text size:{' '}
        <span className="font-semibold text-foreground">{step.label}</span>
        {step.value !== DEFAULT_FONT_SCALE
          ? ` (${Math.round(step.value * 100)}%)`
          : ''}
      </p>

      {/* Live preview — scales with the setting like the rest of the app. */}
      <div className="rounded-[var(--radius)] border border-border bg-background p-4">
        <p className="font-display text-xl font-semibold text-foreground">
          The quick brown fox
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          jumps over the lazy dog. Adjust the size until reading feels
          comfortable — spacing and layout stay the same.
        </p>
      </div>
    </div>
  );
}

export default function AccountAppearancePage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how SchoolWithEase looks and reads for you.
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Theme</CardTitle>
          <CardDescription>
            System follows the light or dark preference of your device.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((option) => {
            const Icon = option.icon;
            const selected = theme === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant="outline"
                onClick={() => setTheme(option.value)}
                aria-pressed={selected}
                className={cn(
                  'h-auto justify-start gap-3 px-4 py-4',
                  selected && 'border-primary bg-primary/10 text-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden />
                {option.label}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Menu on phones</CardTitle>
          <CardDescription>
            On small screens the menu can sit along the bottom, or stay pinned
            down the side as a compact rail. Applies to phone-sized screens only
            — larger screens always use the sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhoneMenuControl />
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Text size</CardTitle>
          <CardDescription>
            Make text larger or smaller across the app without zooming. Saved to
            your account, so it follows you to every device you sign in on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TextSizeControl />
        </CardContent>
      </Card>
    </div>
  );
}
