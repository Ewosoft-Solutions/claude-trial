'use client';

/* ============================================================
   UserMenu — signed-in user avatar + account menu (top bar)

   Mirrors the avatar control in design-export Layout A top bar.
   Renders the user's avatar/initials and an account dropdown
   driven by typed `UserMenuItem`s. No embedded sample data.
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import type {
  UserMenuItem,
  UserProfile,
} from '@workspace/ui/types/shell.types';

export interface UserMenuProps {
  user: UserProfile;
  items?: UserMenuItem[];
  /** Show the name/email block above the menu items. */
  showAccountHeader?: boolean;
  className?: string;
  /** Menu alignment relative to the avatar trigger. */
  align?: 'start' | 'center' | 'end';
}

function UserAvatar({
  user,
  className,
}: {
  user: UserProfile;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-[30px] rounded-full', className)}>
      {user.avatarUrl ? (
        <AvatarImage src={user.avatarUrl} alt={user.name} />
      ) : null}
      <AvatarFallback
        className="text-[11px] font-bold text-white"
        style={{ background: user.color ?? 'var(--muted-foreground)' }}
      >
        {user.initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function UserMenu({
  user,
  items = [],
  showAccountHeader = true,
  className,
  align = 'end',
}: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex shrink-0 items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className,
        )}
        aria-label={`${user.name} — account menu`}
      >
        <UserAvatar user={user} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        {showAccountHeader ? (
          <>
            <DropdownMenuLabel className="flex items-center gap-2.5 py-1.5 font-normal">
              <UserAvatar user={user} className="size-9" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">
                  {user.name}
                </span>
                {user.email ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                ) : null}
                {user.caption ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {user.caption}
                  </span>
                ) : null}
              </span>
            </DropdownMenuLabel>
            {items.length ? <DropdownMenuSeparator /> : null}
          </>
        ) : null}

        {items.map((item) => (
          <React.Fragment key={item.key}>
            {item.separatorBefore ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem
              variant={item.destructive ? 'destructive' : 'default'}
              onSelect={() => item.onSelect?.()}
              {...(item.href && !item.onSelect
                ? { asChild: true }
                : {})}
            >
              {item.href && !item.onSelect ? (
                <a href={item.href}>
                  {item.icon}
                  {item.label}
                  {item.shortcut ? (
                    <DropdownMenuShortcut>
                      {item.shortcut}
                    </DropdownMenuShortcut>
                  ) : null}
                </a>
              ) : (
                <>
                  {item.icon}
                  {item.label}
                  {item.shortcut ? (
                    <DropdownMenuShortcut>
                      {item.shortcut}
                    </DropdownMenuShortcut>
                  ) : null}
                </>
              )}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
