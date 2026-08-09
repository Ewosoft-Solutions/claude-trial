'use client';

/* Click-to-expand avatar. Avatars are initials today; this opens a large
   version in a dialog and is ready to show a real image when one exists. */

import * as React from 'react';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';

import { initials } from './person-detail.types';

export function AvatarLightbox({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        className={`rounded-full ring-offset-background transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className ?? ''}`}
        aria-label={`Expand ${name}'s photo`}
      >
        <Avatar className="size-14">
          {src ? <AvatarImage src={src} alt={name} /> : null}
          <AvatarFallback seed={name} className="text-lg font-semibold">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
      </DialogTrigger>
      <DialogContent className="flex max-w-xs flex-col items-center gap-4 py-8">
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <Avatar className="size-48">
          {src ? <AvatarImage src={src} alt={name} /> : null}
          <AvatarFallback seed={name} className="text-5xl font-semibold">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <span className="font-display text-xl font-semibold text-foreground">
          {name}
        </span>
      </DialogContent>
    </Dialog>
  );
}
