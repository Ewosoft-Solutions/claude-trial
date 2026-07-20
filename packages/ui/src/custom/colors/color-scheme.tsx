'use client';

import * as React from 'react';
import { Palette, Copy, Check } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@workspace/ui/components/drawer';
import { toast } from 'sonner';

// Color variable definitions from globals.css
const colorVariables = [
  { name: 'background', display: 'Background' },
  { name: 'foreground', display: 'Foreground' },
  { name: 'card', display: 'Card' },
  { name: 'card-foreground', display: 'Card Foreground' },
  { name: 'popover', display: 'Popover' },
  { name: 'popover-foreground', display: 'Popover Foreground' },
  { name: 'primary', display: 'Primary' },
  { name: 'primary-foreground', display: 'Primary Foreground' },
  { name: 'secondary', display: 'Secondary' },
  { name: 'secondary-foreground', display: 'Secondary Foreground' },
  { name: 'muted', display: 'Muted' },
  { name: 'muted-foreground', display: 'Muted Foreground' },
  { name: 'accent', display: 'Accent' },
  { name: 'accent-foreground', display: 'Accent Foreground' },
  { name: 'destructive', display: 'Destructive' },
  { name: 'destructive-foreground', display: 'Destructive Foreground' },
  { name: 'border', display: 'Border' },
  { name: 'input', display: 'Input' },
  { name: 'ring', display: 'Ring' },
  { name: 'chart-1', display: 'Chart 1' },
  { name: 'chart-2', display: 'Chart 2' },
  { name: 'chart-3', display: 'Chart 3' },
  { name: 'chart-4', display: 'Chart 4' },
  { name: 'chart-5', display: 'Chart 5' },
  { name: 'sidebar', display: 'Sidebar' },
  { name: 'sidebar-foreground', display: 'Sidebar Foreground' },
  { name: 'sidebar-primary', display: 'Sidebar Primary' },
  { name: 'sidebar-primary-foreground', display: 'Sidebar Primary Foreground' },
  { name: 'sidebar-accent', display: 'Sidebar Accent' },
  { name: 'sidebar-accent-foreground', display: 'Sidebar Accent Foreground' },
  { name: 'sidebar-border', display: 'Sidebar Border' },
  { name: 'sidebar-ring', display: 'Sidebar Ring' },
];

function ColorSwatch({ variableName }: Readonly<{ variableName: string }>) {
  const [computedColor, setComputedColor] = React.useState<string>('');
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    const updateColor = () => {
      const root = document.documentElement;
      const computed = getComputedStyle(root).getPropertyValue(
        `--${variableName}`,
      );
      setComputedColor(computed.trim());
    };

    updateColor();
    // Update on theme change
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, [variableName]);

  const handleCopy = () => {
    const value = computedColor || `var(--${variableName})`;
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`Copied: ${value}`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
      <div
        className="h-12 w-12 rounded-md border shadow-sm shrink-0"
        style={{
          backgroundColor: `var(--${variableName})`,
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{variableName}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">
          {computedColor || `var(--${variableName})`}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        <span className="sr-only">Copy color value</span>
      </Button>
    </div>
  );
}

export function ColorScheme() {
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          aria-label="Open color scheme"
        >
          <Palette className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[60vh]! flex flex-col overflow-hidden">
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Color Scheme Variables</DrawerTitle>
          <DrawerDescription>
            All CSS color variables from your theme. Click the copy button to
            copy values.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-4">
            {colorVariables.map((variable) => (
              <ColorSwatch key={variable.name} variableName={variable.name} />
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
