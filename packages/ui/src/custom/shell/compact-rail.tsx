'use client';

/* ============================================================
   compact-rail — the collapsed icon rail, shared by both hosts

   The collapsed rail is no longer a desktop-only affordance: a phone
   user can PIN it in place of the bottom tab bar (see MobileRail), so
   the rail's stateful parts live here rather than inside AppSidebar.

     • CompactNavItem — the icon + label rail button.
     • useRailFlyout  — the "which section is open, where, how big"
                        state, plus outside-pointer / Escape dismissal.
     • RailFlyout     — the curved panel that carries the submenu.

   AppSidebar drives these at md+ when the sidebar is collapsed;
   MobileRail drives the same three below md when the rail is pinned.
   Everything here is presentational or local state — no navigation
   data (TD-001).
   ============================================================ */

import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import {
  CURVE_SIZE,
  FlyoutContour,
} from '@workspace/ui/custom/shell/flyout-contour';
import {
  hasActiveNavItem,
  NAV_ACTIVE,
  NavElement,
  NavGroups,
} from '@workspace/ui/custom/shell/nav-shared';
import { CountBadge } from '@workspace/ui/custom/data-display/count-badge';
import type { NavPanelData, RailItem } from '@workspace/ui/types/shell.types';

/** Whether a section's panel contains the active route. */
function panelHasActive(panel?: NavPanelData): boolean {
  return (
    panel?.groups.some((group) => group.items.some(hasActiveNavItem)) ?? false
  );
}

/* ---- rail count badge — a small square chip overlaid on the icon ---- */
export function RailBadge({ badge }: { badge: string | number }) {
  return (
    <CountBadge
      count={badge}
      size="sm"
      className="pointer-events-none absolute -right-2 -top-1.5 z-10 border-2 border-background"
    />
  );
}

/* ---- the icon + label rail button (also the flyout's trigger) ---- */
export const COMPACT_ITEM_CLASS = cn(
  'group grid h-[3.375rem] w-[calc(var(--rail-width)-0.5rem)] shrink-0 grid-rows-[2rem_auto] place-items-center gap-0.5 rounded-[var(--radius-sm)] px-0.5 py-0.5 text-muted-foreground outline-none',
  'transition-colors hover:text-foreground',
  'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
  'aria-[current=page]:font-semibold aria-[current=page]:text-foreground',
);

export function CompactNavItem({
  item,
  panel,
  isOpen,
  onTrigger,
}: {
  item: RailItem;
  panel?: NavPanelData;
  /** This item's flyout is the open one. */
  isOpen: boolean;
  /** Click handler — receives the trigger so the host can anchor the flyout. */
  onTrigger: (item: RailItem, trigger: HTMLElement) => void;
}) {
  const controls = item.hasPanel ? `nav-panel-${item.key}` : undefined;
  // A selected submenu item owns the highlight; the parent then steps back.
  const showParentActive = item.active && !(isOpen && panelHasActive(panel));

  return (
    <NavElement
      href={item.hasPanel ? undefined : item.href}
      onSelect={item.hasPanel ? undefined : item.onSelect}
      onPrefetch={item.hasPanel ? item.onPanelPrefetch : item.onPrefetch}
      onClick={(event) => onTrigger(item, event.currentTarget)}
      active={showParentActive}
      aria-controls={controls}
      aria-expanded={item.hasPanel ? isOpen : undefined}
      className={cn(COMPACT_ITEM_CLASS, isOpen && 'focus-visible:ring-0')}
    >
      <span
        className={cn(
          'relative grid size-8 place-items-center rounded-[var(--radius-sm)] transition-colors [&>svg]:size-[19px]',
          'group-hover:bg-accent',
          showParentActive && NAV_ACTIVE,
          isOpen && 'bg-accent text-foreground ring-1 ring-sidebar-ring/60',
        )}
      >
        {item.icon}
        {item.badge != null ? <RailBadge badge={item.badge} /> : null}
      </span>
      <span className="w-full truncate text-center text-[calc(10px*var(--font-scale))] font-medium leading-none">
        {item.label}
      </span>
    </NavElement>
  );
}

/* ============================================================
   useRailFlyout — open section + anchor + measured size
   ============================================================ */
export interface RailFlyoutState {
  /** A section flyout is open (the section exists and has a panel). */
  open: boolean;
  item?: RailItem;
  panel?: NavPanelData;
  /** Offset of the panel from the top of the rail, in px. */
  top: number;
  /** Measured on-screen size, fed to the contour so the curve matches. */
  size: { width: number; height: number };
  surfaceRef: React.RefObject<HTMLElement | null>;
  /** Open (or toggle) the flyout for a rail item, anchored to its trigger. */
  openFrom: (item: RailItem, trigger: HTMLElement) => void;
  close: () => void;
}

export function useRailFlyout({
  items,
  panels,
  containerRef,
  enabled = true,
}: {
  /** Every rail item that can own a flyout (primary + footer). */
  items: RailItem[];
  panels: Record<string, NavPanelData>;
  /** The rail element — an outside pointer press dismisses the flyout. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** False while the host renders its expanded form (no flyouts there). */
  enabled?: boolean;
}): RailFlyoutState {
  const [sectionKey, setSectionKey] = React.useState<string | null>(null);
  const [anchorTop, setAnchorTop] = React.useState(8);
  const [size, setSize] = React.useState({ width: 208, height: 400 });
  const surfaceRef = React.useRef<HTMLElement>(null);

  const item = items.find((candidate) => candidate.key === sectionKey);
  const panel = item ? panels[item.key] : undefined;
  const open =
    enabled && item?.hasPanel === true && Boolean(panel?.groups.length);

  React.useLayoutEffect(() => {
    if (!open) return;
    const surface = surfaceRef.current;
    if (!surface) return;

    const measure = () => {
      const rect = surface.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const next = {
        width: Math.round(rect.width * 2) / 2,
        height: Math.round(rect.height * 2) / 2,
      };
      setSize((current) =>
        current.width === next.width && current.height === next.height
          ? current
          : next,
      );
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [open, item?.key]);

  React.useEffect(() => {
    if (!open) return;

    const dismissOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setSectionKey(null);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSectionKey(null);
    };

    document.addEventListener('pointerdown', dismissOnOutsidePointer);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsidePointer);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open, containerRef]);

  const openFrom = React.useCallback(
    (candidate: RailItem, trigger: HTMLElement) => {
      if (!candidate.hasPanel) {
        setSectionKey(null);
        return;
      }
      const container = containerRef.current;
      if (container) {
        const triggerRect = trigger.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = triggerRect.top - containerRect.top;
        const maximumTop = Math.max(8, containerRect.height - 220);
        setAnchorTop(Math.max(8, Math.min(relativeTop, maximumTop)));
      }
      setSectionKey((current) =>
        candidate.active && current === candidate.key ? null : candidate.key,
      );
    },
    [containerRef],
  );

  const close = React.useCallback(() => setSectionKey(null), []);

  return {
    open,
    item,
    panel,
    top: Math.max(0, anchorTop - CURVE_SIZE),
    size,
    surfaceRef,
    openFrom,
    close,
  };
}

/* ============================================================
   RailFlyout — the curved submenu panel beside the rail
   ============================================================ */
export function RailFlyout({
  state,
  onNavigate,
  /** Touch hosts get a wider panel (a phone flyout at the desktop clamp is
   *  barely wide enough for a submenu label). */
  wide = false,
}: {
  state: RailFlyoutState;
  onNavigate?: () => void;
  wide?: boolean;
}) {
  const { item, panel, top, size, surfaceRef, close } = state;

  return (
    <nav
      ref={surfaceRef as React.Ref<HTMLElement>}
      id={`nav-panel-${item?.key ?? 'section'}`}
      aria-label="Secondary"
      tabIndex={-1}
      className={cn(
        'absolute z-40 flex flex-col outline-none',
        wide
          ? 'w-[clamp(11rem,60vw,15rem)] max-w-[calc(100vw-var(--rail-width)-0.75rem)]'
          : 'w-[clamp(9.5rem,42vw,11.5rem)] max-w-[calc(100vw-var(--rail-width)-0.5rem)]',
      )}
      style={{
        left: 'calc(100% + 0.5px)',
        top,
        maxHeight: `calc(100% - ${top + 8}px)`,
      }}
    >
      <FlyoutContour width={size.width} height={size.height} />

      <div
        data-slot="flyout-content"
        className="relative z-10 my-7 flex min-h-0 flex-col overflow-hidden rounded-r-[var(--radius)] bg-transparent"
      >
        <div className="flex min-h-11 shrink-0 items-center gap-2 border-b border-border px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-base font-semibold leading-tight text-foreground">
              {panel?.header?.title ?? item?.label}
            </div>
            {panel?.header?.subtitle ? (
              <div className="truncate text-[calc(11px*var(--font-scale))] text-muted-foreground">
                {panel.header.subtitle}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
            aria-label="Close secondary navigation"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
          {/* The flyout is already a compact panel beside the rail — no
              hierarchy line needed, so render a plain flat list. */}
          <NavGroups
            groups={panel?.groups ?? []}
            onNavigate={() => {
              onNavigate?.();
              close();
            }}
            tree={false}
          />
        </div>
      </div>
    </nav>
  );
}
