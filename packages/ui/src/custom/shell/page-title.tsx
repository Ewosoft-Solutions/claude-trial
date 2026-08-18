/* ============================================================
   PageTitle — the canonical page heading (Aurora `.main-head` h1)

   ONE place that owns the look of a page title: the Geom display
   face (via `font-display`), the 26px size, and a flat
   `--foreground` fill — the same ink StatGrid gives a stat value,
   so a title and a KPI read as one voice. `PageHeader` renders
   this internally, and any page that lays out its own heading
   (auth screens, icon-prefixed titles) should use it directly so
   every title matches and the styling stays editable in one file.

   Size/leading can be overridden per-call via `className` (tw-merge
   lets a later `text-…` win) for tight contexts like auth cards.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

export interface PageTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Heading element to render. Defaults to `h1`. */
  as?: 'h1' | 'h2' | 'h3';
  children: React.ReactNode;
}

export function PageTitle({
  as: Tag = 'h1',
  className,
  children,
  ...props
}: PageTitleProps) {
  return (
    <Tag
      data-slot="page-title"
      className={cn(
        'w-fit max-w-full break-words font-display text-[calc(24px*var(--font-scale))] font-semibold leading-[1.15] tracking-[0] text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
