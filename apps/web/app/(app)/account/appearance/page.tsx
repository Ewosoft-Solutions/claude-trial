'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
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

const THEMES = [
  { value: 'system', label: 'System', icon: Laptop },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

export default function AccountAppearancePage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how SchoolWithEase looks on this device.
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
    </div>
  );
}
