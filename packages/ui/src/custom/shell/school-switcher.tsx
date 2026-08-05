'use client';

/* ============================================================
   SchoolSwitcher — tenant chip + switch menu

   The active school shows an initials/logo chip; the menu lists the
   schools the user can switch between. Fully data-driven.

   Placement is controlled by `expanded`:
     • undefined — the standalone chip (its original top-bar form).
     • false     — an icon-only chip for the collapsed sidebar rail.
     • true       — a full-width row (chip + role/name + kebab) for the
                    expanded sidebar, directly under the brand.
   ============================================================ */

import * as React from 'react';
import { Check, EllipsisVertical, Plus } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { InitialsAvatar } from '@workspace/ui/custom/data-display/initials-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import type { SchoolOption } from '@workspace/ui/types/shell.types';

function SchoolChip({
  school,
  className,
}: {
  school: SchoolOption;
  className?: string;
}) {
  return (
    <InitialsAvatar
      square
      initials={school.initials}
      name={school.name}
      seed={school.id || school.name}
      color={school.color}
      imageUrl={school.logoUrl}
      className={cn(
        'size-8 shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset]',
        className,
      )}
      textClassName="text-xs font-extrabold"
    />
  );
}

export interface SchoolSwitcherProps {
  schools: SchoolOption[];
  /** Id of the active school. Defaults to the first school. */
  activeSchoolId?: string;
  onSchoolChange?: (school: SchoolOption) => void;
  /** Optional "add school" affordance shown at the foot of the menu. */
  onAddSchool?: () => void;
  addSchoolLabel?: string;
  menuLabel?: string;
  /**
   * Sidebar placement. Leave undefined for the standalone chip. `false`
   * renders an icon-only chip for the collapsed rail; `true` renders a
   * full-width row (chip + role/name + kebab) for the expanded rail.
   */
  expanded?: boolean;
  /**
   * Which side the switch menu opens on. Defaults to `'right'` in the
   * sidebar rail (menu opens beside the narrow rail) and `'bottom'` for the
   * standalone chip. Force `'bottom'` inside a left-anchored mobile drawer,
   * where `'right'` would push the menu off-screen.
   */
  menuSide?: 'right' | 'bottom';
  className?: string;
}

export function SchoolSwitcher({
  schools,
  activeSchoolId,
  onSchoolChange,
  onAddSchool,
  addSchoolLabel = 'Add school',
  menuLabel = 'Switch school',
  expanded,
  menuSide,
  className,
}: SchoolSwitcherProps) {
  const active = schools.find((s) => s.id === activeSchoolId) ?? schools[0];

  if (!active) return null;

  const inSidebar = expanded !== undefined;
  const canOpenMenu = schools.length > 1 || Boolean(onAddSchool);
  const resolvedSide = menuSide ?? (inSidebar ? 'right' : 'bottom');

  const menuContent = (
    <DropdownMenuContent
      align="start"
      side={resolvedSide}
      sideOffset={resolvedSide === 'right' ? 8 : 6}
      collisionPadding={8}
      className="w-80 max-w-[calc(100vw-1rem)] p-1.5 text-left"
    >
      <DropdownMenuLabel className="px-2.5 py-2 text-left text-muted-foreground">
        {menuLabel}
      </DropdownMenuLabel>
      {schools.map((school) => (
        <DropdownMenuItem
          key={school.id}
          onSelect={() => onSchoolChange?.(school)}
          className="min-h-12 gap-3 px-2.5 py-2 text-left"
        >
          <SchoolChip school={school} />
          <span className="flex min-w-0 flex-col items-start text-left leading-tight">
            <span className="w-full truncate text-left font-medium text-foreground">
              {school.name}
            </span>
            {school.caption ? (
              <span className="w-full truncate text-left text-xs text-muted-foreground">
                {school.caption}
              </span>
            ) : null}
          </span>
          {school.id === active.id ? (
            <Check className="ml-auto size-4 text-primary" aria-hidden />
          ) : null}
        </DropdownMenuItem>
      ))}
      {onAddSchool ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => onAddSchool()}
            className="min-h-12 gap-3 px-2.5 py-2 text-left"
          >
            <span className="grid size-8 place-items-center rounded-[7px] border border-dashed border-border text-muted-foreground">
              <Plus className="size-4" aria-hidden />
            </span>
            <span className="font-medium">{addSchoolLabel}</span>
          </DropdownMenuItem>
        </>
      ) : null}
    </DropdownMenuContent>
  );

  /* ---- collapsed sidebar rail: icon-only chip ---- */
  if (inSidebar && !expanded) {
    if (!canOpenMenu) {
      return (
        <div
          className="grid size-9 place-items-center"
          aria-label={active.name}
        >
          <SchoolChip school={active} />
        </div>
      );
    }
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'grid size-9 place-items-center rounded-[9px] outline-none transition-shadow',
            'hover:ring-2 hover:ring-sidebar-ring/50 focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/60',
            className,
          )}
          aria-label={`${active.name} — ${menuLabel}`}
        >
          <SchoolChip school={active} />
        </DropdownMenuTrigger>
        {menuContent}
      </DropdownMenu>
    );
  }

  /* ---- expanded sidebar rail: full-width row with kebab ---- */
  if (inSidebar) {
    const rowClass = cn(
      'flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] p-2 text-left outline-none',
      'transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
      className,
    );
    const row = (
      <>
        <SchoolChip school={active} className="size-9" />
        <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
          {active.caption ? (
            <span className="w-full truncate text-left text-[11px] font-medium leading-tight text-muted-foreground">
              {active.caption}
            </span>
          ) : null}
          <span className="w-full truncate text-left text-[13px] font-semibold leading-tight text-foreground">
            {active.name}
          </span>
        </span>
        {canOpenMenu ? (
          <EllipsisVertical
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </>
    );

    if (!canOpenMenu) {
      return <div className={cn(rowClass, 'cursor-default')}>{row}</div>;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={rowClass}
          aria-label={`${active.name} — ${menuLabel}`}
        >
          {row}
        </DropdownMenuTrigger>
        {menuContent}
      </DropdownMenu>
    );
  }

  /* ---- standalone chip (original top-bar form) ---- */
  const chip = (
    <>
      <SchoolChip school={active} />
      {/* role stacked over the school name (role lives here, not on the profile) */}
      <span className="flex min-w-0 max-w-[11rem] flex-col items-start text-left leading-tight sm:max-w-[15rem]">
        {active.caption ? (
          <span className="w-full truncate text-left text-[11px] font-medium leading-tight text-muted-foreground">
            {active.caption}
          </span>
        ) : null}
        <span className="w-full truncate text-left text-[13px] font-semibold leading-tight text-foreground">
          {active.name}
        </span>
      </span>
      {canOpenMenu ? (
        <EllipsisVertical
          className="ml-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </>
  );

  const triggerClass = cn(
    'flex min-w-0 shrink items-center gap-2.5 overflow-hidden rounded-[var(--radius-sm)] border border-border bg-card py-2 pl-2 pr-2.5 text-left text-[13px] text-foreground outline-none',
    'max-sm:gap-2 max-sm:pr-2',
    'transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
    className,
  );

  if (!canOpenMenu) {
    return <div className={cn(triggerClass, 'cursor-default')}>{chip}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={triggerClass}
        aria-label={`${active.name} — ${menuLabel}`}
      >
        {chip}
      </DropdownMenuTrigger>
      {menuContent}
    </DropdownMenu>
  );
}
