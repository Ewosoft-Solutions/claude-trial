'use client';

/* ============================================================
   MobileNav — Aurora mobile navigation (below md)

   Replaces the push-drawer behaviour that squeezed the content
   column on phones. Two coordinated surfaces:

     • Bottom tab bar — the first few persona-resolved destinations
       (thumb-reachable) plus a "More" tab. Fixed to the bottom, it
       overlays nothing structural: the shell reserves matching space
       via --shell-mobile-bottom-inset so content never hides behind
       it.
     • Overlay drawer — a left sheet (scrim + focus trap + scroll lock
       via Radix) holding the FULL navigation with accordion
       sub-sections, plus theme, profile, and utility items.

   Both surfaces are fed the same RBAC-resolved RailItem[] the desktop
   rail consumes, so every persona (owner, teacher, parent, student,
   finance, platform admin) gets the correct destinations with no
   role logic here (TD-001). Rendered only below md; the desktop rail
   (AppSidebar) is hidden there and takes over at md+.
   ============================================================ */

import * as React from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@workspace/ui/components/sheet';
import {
  hasActiveNavItem,
  MOBILE_NAV_ROW_STYLE,
  NAV_ACTIVE,
  NavElement,
  NavGroups,
  SidebarProfile,
  ThemeControl,
} from '@workspace/ui/custom/shell/nav-shared';
import { CountBadge } from '@workspace/ui/custom/data-display/count-badge';
import type {
  NavPanelData,
  RailItem,
  UserMenuItem,
  UserProfile,
} from '@workspace/ui/types/shell.types';

export interface MobileNavProps {
  /** Brand wordmark shown at the top of the drawer. */
  brandLabel?: string;
  /** Primary destinations (RBAC-resolved). */
  railItems: RailItem[];
  /** Utility items pinned above the drawer footer (e.g. Help). */
  railFooterItems?: RailItem[];
  /** Secondary panels keyed by section, for the drawer's accordion. */
  navPanels?: Record<string, NavPanelData>;
  /** Tenant/school context switcher, rendered at the top of the drawer.
   *  Receives `true` (the drawer is always an expanded surface) and a
   *  `menuSide` hint of `'bottom'` so the switch menu drops down inside the
   *  drawer instead of opening off the right edge. */
  schoolSwitcher?: (
    expanded: boolean,
    menuSide?: 'right' | 'bottom',
  ) => React.ReactNode;
  /** Optional card beneath the drawer nav (e.g. a progress card). */
  navFooter?: React.ReactNode;
  /** Signed-in user rendered in the drawer footer. */
  user?: UserProfile;
  /** Account menu items for the drawer profile. */
  userMenuItems?: UserMenuItem[];
  /**
   * How many destinations to surface as bottom tabs before the "More"
   * tab. Four + More keeps every target within a comfortable thumb
   * sweep — the platform convention.
   */
  primaryTabCount?: number;
  className?: string;
}

/* ---- bottom-bar count badge — a small square chip overlaid on the icon ---- */
function TabBadge({ badge }: { badge: string | number }) {
  return (
    <CountBadge
      count={badge}
      size="sm"
      className="pointer-events-none absolute -right-1.5 -top-1 z-10 border-2 border-sidebar"
    />
  );
}

/* ---- bottom-bar tab: shared layout + inner visual ---- */
const TAB_CLASS = cn(
  'group flex h-full min-w-0 flex-col items-center justify-center gap-1 px-1 pt-1.5 outline-none',
  'focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-sidebar-ring/50',
);

function TabInner({
  icon,
  label,
  active,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: string | number;
}) {
  return (
    <>
      <span
        className={cn(
          'relative grid size-9 place-items-center rounded-full transition-colors [&>svg]:size-[20px]',
          active
            ? NAV_ACTIVE
            : 'text-muted-foreground group-hover:bg-accent group-hover:text-foreground',
        )}
      >
        {icon}
        {badge != null ? <TabBadge badge={badge} /> : null}
      </span>
      <span
        className={cn(
          'max-w-full truncate text-[calc(10px*var(--font-scale))] font-medium leading-none',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </>
  );
}

/* ---- drawer row (expanded style, mirrors the desktop rail) ---- */
const DRAWER_ROW_CLASS = cn(
  'group flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 text-[calc(13.5px*var(--font-scale))] font-medium text-muted-foreground outline-none',
  'transition-colors hover:bg-accent hover:text-foreground',
  'focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50',
  'aria-[current=page]:font-semibold aria-[current=page]:bg-primary/10 aria-[current=page]:[background-image:var(--grad-nav-active)] aria-[current=page]:text-foreground aria-[current=page]:ring-1 aria-[current=page]:ring-inset aria-[current=page]:ring-white/10',
);

function DrawerSection({
  item,
  panel,
  open,
  onToggle,
  onNavigate,
}: {
  item: RailItem;
  panel?: NavPanelData;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const hasPanel = Boolean(item.hasPanel && panel?.groups.length);
  const controls = `mobile-section-${item.key}`;

  if (!hasPanel) {
    return (
      <NavElement
        href={item.href}
        onSelect={() => {
          item.onSelect?.();
          onNavigate();
        }}
        onPrefetch={item.onPrefetch}
        active={item.active}
        style={MOBILE_NAV_ROW_STYLE}
        className={DRAWER_ROW_CLASS}
      >
        <span className="relative grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] [&>svg]:size-[18px]">
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        {item.badge != null ? (
          <CountBadge count={item.badge} size="md" />
        ) : null}
      </NavElement>
    );
  }

  const panelHasActive =
    panel?.groups.some((group) => group.items.some(hasActiveNavItem)) ?? false;
  // A selected submenu item owns the highlight; the parent keeps only an
  // outline (mirrors the desktop rail's inline accordion).
  const childActive = open && panelHasActive;
  const showParentActive = Boolean(item.active) && !childActive;
  const showParentOutline = Boolean(item.active) && childActive;

  return (
    <>
      <NavElement
        onSelect={onToggle}
        onPrefetch={item.onPanelPrefetch}
        active={showParentActive}
        style={MOBILE_NAV_ROW_STYLE}
        aria-controls={controls}
        aria-expanded={open}
        className={cn(
          DRAWER_ROW_CLASS,
          showParentOutline &&
            'font-semibold text-foreground ring-1 ring-inset ring-primary/40',
        )}
      >
        <span className="relative grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] [&>svg]:size-[18px]">
          {item.icon}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        {item.badge != null ? (
          <CountBadge count={item.badge} size="md" />
        ) : null}
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </NavElement>
      {open ? (
        <div id={controls} className="mb-px">
          <NavGroups groups={panel?.groups ?? []} onNavigate={onNavigate} />
        </div>
      ) : null}
    </>
  );
}

export function MobileNav({
  brandLabel = 'SchoolWithEase',
  railItems,
  railFooterItems,
  navPanels = {},
  schoolSwitcher,
  navFooter,
  user,
  userMenuItems = [],
  primaryTabCount = 4,
  className,
}: MobileNavProps) {
  const [open, setOpen] = React.useState(false);

  const activeKey = [...railItems, ...(railFooterItems ?? [])].find(
    (item) => item.active,
  )?.key;

  // Accordion: `undefined` means "follow the active section" until the user
  // opens/closes one explicitly (then it is a string key or null).
  const [openSection, setOpenSection] = React.useState<
    string | null | undefined
  >(undefined);
  const resolvedOpen = openSection === undefined ? activeKey : openSection;

  // Re-sync the accordion to the active section each time the drawer opens.
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (open && !wasOpen.current) setOpenSection(undefined);
    wasOpen.current = open;
  }, [open]);

  const primary = railItems.slice(0, Math.max(0, primaryTabCount));
  const moreActive = !primary.some((item) => item.active);
  const closeDrawer = React.useCallback(() => setOpen(false), []);

  const toggleSection = (key: string) =>
    setOpenSection((current) =>
      (current === undefined ? activeKey : current) === key ? null : key,
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <nav
        aria-label="Primary"
        data-slot="mobile-tab-bar"
        // --sidebar-solid is the opaque match of the rail; the plain --sidebar
        // role is a near-transparent wash meant to sit over the page, so as a
        // floating bar it would let content show through. Set via inline style
        // rather than a token-arbitrary background utility so it always applies
        // and can't be dropped by class merging.
        style={{
          backgroundColor:
            'color-mix(in oklab, var(--sidebar-solid) 94%, transparent)',
        }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-border pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden',
          className,
        )}
      >
        <div
          className="mx-auto grid h-14 max-w-lg"
          style={{
            gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {primary.map((item) => (
            <NavElement
              key={item.key}
              href={item.href}
              onSelect={item.onSelect}
              onPrefetch={
                item.hasPanel ? item.onPanelPrefetch : item.onPrefetch
              }
              active={Boolean(item.active)}
              className={TAB_CLASS}
            >
              <TabInner
                icon={item.icon}
                label={item.label}
                active={Boolean(item.active)}
                badge={item.badge}
              />
            </NavElement>
          ))}
          <SheetTrigger
            className={TAB_CLASS}
            aria-label="More"
            aria-controls="mobile-nav-drawer"
          >
            <TabInner icon={<Menu />} label="More" active={moreActive} />
          </SheetTrigger>
        </div>
      </nav>

      <SheetContent
        side="left"
        showCloseButton={false}
        id="mobile-nav-drawer"
        // Opaque fill (see the tab-bar note) so the page never shows through
        // the drawer. Inline style guarantees it over the sheet's own
        // bg-background and any class merging.
        style={{ backgroundColor: 'var(--sidebar-solid)' }}
        className="flex w-[min(20rem,88vw)] flex-col gap-0 border-r border-border p-0 sm:max-w-[min(20rem,88vw)]"
      >
        {/* Lead with the CUSTOMER's identity — the school lockup (same as the
            desktop rail); the product wordmark is demoted to a small footer
            signature. The dialog keeps an accessible (sr-only) title. */}
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Browse all sections and account options.
        </SheetDescription>
        <div className="flex h-[var(--header-height)] shrink-0 items-center gap-2 px-2">
          <div className="min-w-0 flex-1">
            {schoolSwitcher ? (
              schoolSwitcher(true, 'bottom')
            ) : (
              <span className="truncate pl-2 font-display text-[calc(22px*var(--font-scale))] font-semibold leading-none text-foreground">
                {brandLabel}
              </span>
            )}
          </div>
          {/* Divider separating the switcher (and its kebab) from the close
              "X", so the two read as distinct controls rather than two
              adjacent menu icons. */}
          <div className="h-6 w-px shrink-0 bg-border" aria-hidden />
          <SheetClose
            className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
            aria-label="Close navigation"
          >
            <X className="size-5" aria-hidden />
          </SheetClose>
        </div>

        <div className="h-px w-full shrink-0 bg-border" />

        {/* Full navigation with accordion sub-sections */}
        <nav
          aria-label="All sections"
          // pt aligns the first nav item with the page title ("Good morning…"),
          // which sits --content-padding below the top bar; the -1px accounts
          // for the divider between the header row and the nav.
          className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto overscroll-contain px-2 pb-2 pt-[calc(var(--content-padding)_-_1px)]"
        >
          {railItems.map((item) => (
            <DrawerSection
              key={item.key}
              item={item}
              panel={navPanels[item.key]}
              open={resolvedOpen === item.key}
              onToggle={() => toggleSection(item.key)}
              onNavigate={closeDrawer}
            />
          ))}
        </nav>

        {navFooter ? (
          <div className="shrink-0 px-2 pb-1">{navFooter}</div>
        ) : null}

        <div className="h-px w-full shrink-0 bg-border" />

        {/* Utility footer: help · theme · profile */}
        <div className="flex shrink-0 flex-col gap-1 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {railFooterItems?.map((item) => (
            <DrawerSection
              key={item.key}
              item={item}
              panel={navPanels[item.key]}
              open={resolvedOpen === item.key}
              onToggle={() => toggleSection(item.key)}
              onNavigate={closeDrawer}
            />
          ))}
          <ThemeControl expanded variant="curve" />
          {user ? (
            <SidebarProfile user={user} items={userMenuItems} expanded />
          ) : null}
          {/* Product signature — demoted from the top of the drawer to a small,
              muted line at the foot (only when the school leads above). */}
          {schoolSwitcher ? (
            <div className="pt-1 text-center">
              <span className="font-display text-[calc(15px*var(--font-scale))] leading-tight text-muted-foreground/70">
                {brandLabel}
              </span>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
