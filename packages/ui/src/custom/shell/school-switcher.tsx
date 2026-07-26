'use client';

/* ============================================================
   SchoolSwitcher — tenant chip + switch menu (Aurora top bar)

   Mirrors the `.tenant` control in design-export Layout A. The
   active school shows an initials/logo chip; the menu lists the
   schools the user can switch between. Fully data-driven.
   ============================================================ */

import * as React from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';

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
        'size-6 shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset]',
        className,
      )}
      textClassName="text-[10px] font-extrabold"
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
  className?: string;
}

export function SchoolSwitcher({
  schools,
  activeSchoolId,
  onSchoolChange,
  onAddSchool,
  addSchoolLabel = 'Add school',
  menuLabel = 'Switch school',
  className,
}: SchoolSwitcherProps) {
  const active = schools.find((s) => s.id === activeSchoolId) ?? schools[0];

  if (!active) return null;

  const canOpenMenu = schools.length > 1 || Boolean(onAddSchool);

  const chip = (
    <>
      <SchoolChip school={active} />
      {/* role stacked over the school name (role lives here, not on the profile) */}
      <span className="flex min-w-0 max-w-[10rem] flex-col items-start text-left leading-tight sm:max-w-[14rem]">
        {active.caption ? (
          <span className="w-full truncate text-[11px] font-medium leading-tight text-muted-foreground">
            {active.caption}
          </span>
        ) : null}
        <span className="w-full truncate text-[13px] font-semibold leading-tight text-foreground">
          {active.name}
        </span>
      </span>
      {canOpenMenu ? (
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : null}
    </>
  );

  const triggerClass = cn(
    'flex min-w-0 shrink items-center gap-2 overflow-hidden rounded-[var(--radius-sm)] border border-border bg-card py-1 pl-1.5 pr-2 text-[13px] text-foreground outline-none',
    'max-sm:gap-1.5',
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
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground">
          {menuLabel}
        </DropdownMenuLabel>
        {schools.map((school) => (
          <DropdownMenuItem
            key={school.id}
            onSelect={() => onSchoolChange?.(school)}
            className="gap-2.5"
          >
            <SchoolChip school={school} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-foreground">
                {school.name}
              </span>
              {school.caption ? (
                <span className="truncate text-xs text-muted-foreground">
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
              className="gap-2.5"
            >
              <span className="grid size-[22px] place-items-center rounded-md border border-dashed border-border text-muted-foreground">
                <Plus className="size-3.5" aria-hidden />
              </span>
              <span className="font-medium">{addSchoolLabel}</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
