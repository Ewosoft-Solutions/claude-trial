'use client';

/* ============================================================
   InitialsAvatar — the canonical avatar for people & tenants

   Wraps the base Avatar with deterministic neon initials (Teams/Slack
   style). Pass a `name` (initials are derived) or explicit `initials`,
   an optional `imageUrl`, and a stable `seed` (email/id) so the same
   person always gets the same colour. Use `color` to force a brand tint
   (e.g. a school), and `square` for tenant chips. Prefer this over
   hand-rolled `<Avatar><AvatarFallback>` blocks so every initial in the
   app is coloured consistently.
   ============================================================ */

import * as React from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar';
import { deriveInitials } from '@workspace/ui/lib/names';
import { cn } from '@workspace/ui/lib/utils';

export interface InitialsAvatarProps {
  /** Display name — used for initials and, unless `seed` is set, the colour. */
  name?: string;
  /** Explicit initials (overrides derivation from `name`). */
  initials?: string;
  /** Stable colour seed (email/id). Falls back to `name`. */
  seed?: string;
  /** Optional avatar image; falls back to coloured initials. */
  imageUrl?: string;
  /** Force a background colour (e.g. a school brand tint) instead of neon. */
  color?: string;
  /** Rounded-square (tenant chip) instead of a circle. */
  square?: boolean;
  /** Sizing / extra classes on the avatar root (default `size-8`). */
  className?: string;
  /** Font-size class for the initials (default `text-xs`). */
  textClassName?: string;
}

export function InitialsAvatar({
  name,
  initials,
  seed,
  imageUrl,
  color,
  square,
  className,
  textClassName,
}: InitialsAvatarProps) {
  const text = initials ?? deriveInitials(name);
  const radius = square ? 'rounded-[7px]' : 'rounded-full';

  return (
    <Avatar className={cn('size-8', radius, className)}>
      {imageUrl ? (
        <AvatarImage src={imageUrl} alt={name ?? ''} className={radius} />
      ) : null}
      <AvatarFallback
        seed={seed ?? name ?? text}
        style={color ? { background: color } : undefined}
        className={cn('font-bold text-white', radius, textClassName ?? 'text-xs')}
      >
        {text}
      </AvatarFallback>
    </Avatar>
  );
}
