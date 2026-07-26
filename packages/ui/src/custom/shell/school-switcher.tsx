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
        <ChevronDown
          className="ml-0.5 size-3.5 shrink-0 text-muted-foreground"
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
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-72 p-1.5 text-left"
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
    </DropdownMenu>
  );
}
