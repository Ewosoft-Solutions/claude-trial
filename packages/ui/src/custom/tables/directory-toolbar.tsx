'use client';

/* ============================================================
   DirectoryToolbar — Pattern B toolbar for governed tables.

   One line: search + a single "Filters" button, side by side, plus any
   primary actions. Applied filters render as removable pills in their own
   band below the header (see DirectoryFilterPills, placed in the layout's
   filterBar slot).

   Collapse is driven by one viewport signal so nothing is ever stranded:
     • wide (≥1024) — search is fixed-width, secondary controls (views,
       save, columns, delete) sit inline, and the Filters button opens a
       dropdown of just the filter groups.
     • compact (<1024, incl. tablet) — search grows edge-to-edge next to the
       Filters button, and every secondary section folds into that button's
       dropdown (filters · saved views · columns · Apply / Save view).

   Column visibility is owned by the consumer so the Columns control can live
   here and fold into the dropdown.
   ============================================================ */

import * as React from 'react';
import {
  Bookmark,
  Check,
  Columns3,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { CountBadge } from '@workspace/ui/custom/data-display/count-badge';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@workspace/ui/components/sheet';
import { useIsMobile, useMediaQuery } from '@workspace/ui/hooks/use-mobile';
import { Dot } from '@workspace/ui/custom/data-display/dot';

export interface ToolbarFilterOption {
  value: string;
  label: string;
}

/** A single-select filter dimension (e.g. Status). */
export interface ToolbarFilter {
  key: string;
  label: string;
  options: ToolbarFilterOption[];
}

export interface ToolbarSavedView {
  id: string;
  name: string;
  shared?: boolean;
  /** Show a per-view delete affordance in the compact menu. */
  canDelete?: boolean;
}

export interface ToolbarColumn {
  id: string;
  label: string;
  visible: boolean;
}

export interface ToolbarViews {
  options: ToolbarSavedView[];
  currentId: string | null;
  onSelect: (id: string | null) => void;
  /** Label for the "no view" option. Defaults to "All records". */
  allLabel?: string;
  onSave?: () => void;
  onDelete?: (id: string) => void;
}

export interface ToolbarColumns {
  items: ToolbarColumn[];
  onToggle: (id: string, visible: boolean) => void;
}

export interface DirectoryToolbarProps {
  search: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Accessible label (visually hidden). */
    label?: string;
    id?: string;
  };
  filters?: ToolbarFilter[];
  filterValues?: Record<string, string | null | undefined>;
  onFilterChange?: (key: string, value: string | null) => void;
  /** Clears every applied filter (the dropdown's "Reset"). */
  onClearFilters?: () => void;
  views?: ToolbarViews;
  columns?: ToolbarColumns;
  /** Inline actions rendered at the end of the row (e.g. a primary button). */
  actions?: React.ReactNode;
}

const CATEGORY_LABEL =
  'text-[calc(11px*var(--font-scale))] font-bold uppercase tracking-wider text-muted-foreground';

/** Every toolbar control — search, buttons, dropdowns — reads as border-only
 *  over the card (the design system's Filters-button colour). */
const CONTROL_SURFACE: React.CSSProperties = { backgroundColor: 'transparent' };

export function activeFilterEntries(
  filters: ToolbarFilter[] | undefined,
  filterValues: Record<string, string | null | undefined> | undefined,
): { filter: ToolbarFilter; value: string }[] {
  return (filters ?? [])
    .map((filter) => ({ filter, value: filterValues?.[filter.key] }))
    .filter((x): x is { filter: ToolbarFilter; value: string } => {
      return x.value != null && x.value !== '';
    });
}

function optionLabel(filter: ToolbarFilter, value: string): string {
  return filter.options.find((o) => o.value === value)?.label ?? value;
}

export function DirectoryToolbar({
  search,
  filters = [],
  filterValues = {},
  onFilterChange,
  onClearFilters,
  views,
  columns,
  actions,
}: DirectoryToolbarProps) {
  // Only the overlay TYPE is JS-driven (invisible until clicked → no flash):
  // phones (<768) get a bottom drawer; tablet + desktop get the dropdown. The
  // toolbar layout itself stays CSS-driven (lg: utilities, below).
  const isMobile = useIsMobile();
  // Whether saved-view + columns sit inline (≥lg) rather than folded into the
  // Filters menu (<lg). Only gates the reset button inside the menu (which is
  // closed at first paint), so a media-query hook here can't cause a flash.
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const generatedId = React.useId();
  const searchId = search.id ?? generatedId;

  const filterCount = activeFilterEntries(filters, filterValues).length;
  const setFilterValue = (key: string, value: string | null) =>
    onFilterChange?.(key, value);

  const currentView = views?.options.find((v) => v.id === views.currentId);

  // Plain-element sections (MenuSectionLabel/MenuDivider, not DropdownMenu
  // primitives) so the exact same markup renders inside the desktop dropdown
  // AND the mobile drawer.
  const filterGroups = filters.map((filter, index) => (
    <React.Fragment key={filter.key}>
      {index > 0 ? <MenuDivider /> : null}
      <MenuSectionLabel>{filter.label}</MenuSectionLabel>
      {filter.options.map((option) => (
        <RadioOptionRow
          key={option.value}
          checked={filterValues[filter.key] === option.value}
          onSelect={() => setFilterValue(filter.key, option.value)}
        >
          {option.label}
        </RadioOptionRow>
      ))}
    </React.Fragment>
  ));

  const filtersButton = (
    <Button
      variant="outline"
      size="default"
      aria-label="Filters"
      style={CONTROL_SURFACE}
    >
      <SlidersHorizontal aria-hidden />
      Filters
      {filterCount > 0 ? (
        <CountBadge count={filterCount} tone="primary" size="md" />
      ) : null}
    </Button>
  );

  // Reset clears everything the Filters menu currently CONTAINS: its filter
  // groups always, plus — only when they're folded in (below lg) — the saved
  // view back to default (never deleting it) and every column back to visible.
  // It leaves saved-view/columns alone when they sit inline on desktop, and
  // never touches the search box (which lives outside the menu).
  const savedViewResettable = !!views && views.currentId != null;
  const columnsResettable = !!columns && columns.items.some((c) => !c.visible);
  const foldedResettable =
    !isDesktop && (savedViewResettable || columnsResettable);

  function handleReset() {
    onClearFilters?.();
    if (isDesktop) return;
    if (views?.currentId != null) views.onSelect(null);
    if (columns) {
      for (const column of columns.items) {
        if (!column.visible) columns.onToggle(column.id, true);
      }
    }
  }

  const resetButton = (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
      disabled={filterCount === 0 && !foldedResettable}
      onClick={handleReset}
    >
      Reset
    </Button>
  );

  // Saved-view + Columns sections — only folded into the mobile drawer (on
  // desktop they live inline in the toolbar).
  const savedViewSection = views ? (
    <>
      <MenuDivider />
      <MenuSectionLabel>Saved view</MenuSectionLabel>
      <ViewRow
        selected={views.currentId == null}
        onSelect={() => views.onSelect(null)}
        label={views.allLabel ?? 'All records'}
      />
      {views.options.map((view) => (
        <ViewRow
          key={view.id}
          selected={views.currentId === view.id}
          onSelect={() => views.onSelect(view.id)}
          label={
            <>
              {view.name}
              {view.shared ? (
                <span className="text-muted-foreground">
                  <Dot />
                  shared
                </span>
              ) : null}
            </>
          }
          canDelete={view.canDelete && Boolean(views.onDelete)}
          onDelete={() => views.onDelete?.(view.id)}
        />
      ))}
    </>
  ) : null;

  const columnsSection =
    columns && columns.items.length > 0 ? (
      <>
        <MenuDivider />
        <MenuSectionLabel>Columns</MenuSectionLabel>
        {columns.items.map((column) => (
          <CheckOptionRow
            key={column.id}
            checked={column.visible}
            onChange={(checked) => columns.onToggle(column.id, checked)}
          >
            {column.label}
          </CheckOptionRow>
        ))}
      </>
    ) : null;

  // Save view + Apply — shared by the drawer footer and the tablet dropdown.
  const filterFooter = (
    <>
      {views?.onSave ? (
        <Button
          variant="outline"
          size="default"
          className="flex-1"
          onClick={() => {
            setFiltersOpen(false);
            views.onSave?.();
          }}
        >
          <Bookmark aria-hidden /> Save view
        </Button>
      ) : null}
      <Button
        size="default"
        className="flex-1"
        onClick={() => setFiltersOpen(false)}
      >
        Apply
      </Button>
    </>
  );

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Label htmlFor={searchId} className="sr-only">
          {search.label ?? 'Search'}
        </Label>
        <Input
          id={searchId}
          type="search"
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={search.placeholder ?? 'Search…'}
          className="rounded-sm pl-8"
        />
      </div>

      {filters.length > 0 ? (
        isMobile ? (
          // Phone: a bottom drawer holding filters + views + columns.
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>{filtersButton}</SheetTrigger>
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="max-h-[85vh] gap-0 rounded-t-[var(--radius)] p-0"
            >
              <div className="flex items-center gap-3 border-b border-border px-5 py-3">
                <SheetTitle className="flex-1 text-sm">
                  Filters &amp; view
                </SheetTitle>
                {resetButton}
                <div className="h-5 w-px bg-border" aria-hidden />
                <SheetClose asChild>
                  <button
                    type="button"
                    aria-label="Close"
                    className="grid size-7 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </SheetClose>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {filterGroups}
                {savedViewSection}
                {columnsSection}
              </div>
              <div className="flex items-center gap-2 border-t border-border px-5 py-3">
                {filterFooter}
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          // Tablet + desktop: a dropdown anchored to the button. Below lg the
          // folded views/columns/footer show (tablet has no inline controls);
          // at lg+ they're CSS-hidden because those controls sit inline.
          <DropdownMenu open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DropdownMenuTrigger asChild>{filtersButton}</DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-0">
              <div className="flex items-center justify-between border-b border-border py-1.5 pr-1.5 pl-3">
                <span className="text-sm font-semibold text-foreground">
                  <span className="lg:hidden">Filters &amp; view</span>
                  <span className="hidden lg:inline">Filters</span>
                </span>
                {resetButton}
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-1">
                {filterGroups}
                <div className="lg:hidden">
                  {savedViewSection}
                  {columnsSection}
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-border p-2 lg:hidden">
                {filterFooter}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      ) : null}

      {/* Desktop-only inline secondary controls; CSS-hidden below lg to match
          the folded dropdown above (no JS, no load flash). */}
      {views || columns ? (
        <div className="hidden items-center gap-2 lg:flex">
          {views ? (
            <Select
              value={views.currentId ?? 'none'}
              onValueChange={(v) => views.onSelect(v === 'none' ? null : v)}
            >
              <SelectTrigger
                className="w-[10rem] rounded-sm"
                style={CONTROL_SURFACE}
                aria-label="Saved views"
              >
                <Bookmark className="size-3.5" aria-hidden />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {views.allLabel ?? 'All records'}
                </SelectItem>
                {views.options.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    {view.name}
                    {view.shared ? ' · shared' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {views?.onSave ? (
            <Button
              variant="outline"
              size="default"
              style={CONTROL_SURFACE}
              onClick={views.onSave}
            >
              <Bookmark aria-hidden /> Save view
            </Button>
          ) : null}

          {currentView?.canDelete && views?.onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => views.onDelete?.(currentView.id)}
              aria-label="Delete this saved view"
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}

          {columns && columns.items.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="default"
                  style={CONTROL_SURFACE}
                >
                  <Columns3 aria-hidden /> Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 p-1">
                <DropdownMenuLabel className={CATEGORY_LABEL}>
                  Columns
                </DropdownMenuLabel>
                {columns.items.map((column) => (
                  <CheckOptionRow
                    key={column.id}
                    checked={column.visible}
                    onChange={(checked) => columns.onToggle(column.id, checked)}
                  >
                    {column.label}
                  </CheckOptionRow>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      ) : null}

      {actions}
    </div>
  );
}

/** Section header + divider as plain elements (not DropdownMenu primitives, so
 *  they render in the mobile drawer too). */
function MenuSectionLabel({ children }: { children: React.ReactNode }) {
  return <div className={cn(CATEGORY_LABEL, 'px-2 py-1.5')}>{children}</div>;
}

function MenuDivider() {
  return <div className="-mx-1 my-1 h-px bg-border" />;
}

/** Circular radio glyph (ring + centre dot, no checkmark) — for single-select
 *  groups, matching how design systems distinguish radios from checkboxes. */
function RadioGlyph({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded-full border transition-colors',
        checked ? 'border-primary' : 'border-input',
      )}
    >
      {checked ? <span className="size-2 rounded-full bg-primary" /> : null}
    </span>
  );
}

/** A single-select menu row rendered as a real radio (circular, no check). */
function RadioOptionRow({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
    >
      <RadioGlyph checked={checked} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
}

/** A multi-select menu row with a visible square checkbox (box + check) so the
 *  toggle reads clearly for all ages. The row itself is the control — a <div>,
 *  not a <button>, so it can hold the glyph without nesting interactives. */
function CheckOptionRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        className={cn(
          'grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors',
          checked
            ? 'border-primary-surface bg-primary-surface text-primary-surface-foreground'
            : 'border-input',
        )}
      >
        {checked ? <Check className="size-3" aria-hidden /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </div>
  );
}

function ViewRow({
  selected,
  onSelect,
  label,
  canDelete,
  onDelete,
}: {
  selected: boolean;
  onSelect: () => void;
  label: React.ReactNode;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-sm pr-1 hover:bg-accent">
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm"
      >
        <RadioGlyph checked={selected} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
      {canDelete && onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete view"
          className="grid size-6 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Applied-filter pills band — render in the table layout's `filterBar` slot. */
export function DirectoryFilterPills({
  filters,
  filterValues,
  onFilterChange,
  onClearFilters,
  formatFilterValue,
}: {
  filters?: ToolbarFilter[];
  filterValues?: Record<string, string | null | undefined>;
  onFilterChange?: (key: string, value: string | null) => void;
  onClearFilters?: () => void;
  formatFilterValue?: (key: string, value: string) => string;
}) {
  const active = activeFilterEntries(filters, filterValues);
  if (active.length === 0) return null;

  return (
    <>
      <span className="text-[calc(12px*var(--font-scale))] font-semibold text-muted-foreground">
        Filters
      </span>
      {active.map(({ filter, value }) => (
        <span
          key={filter.key}
          className="inline-flex items-center gap-1 rounded-[0.5rem] border py-0.5 pl-2 pr-1 text-xs text-foreground"
          style={{
            backgroundColor:
              'color-mix(in oklab, var(--primary) 14%, var(--card))',
            borderColor: 'color-mix(in oklab, var(--primary) 30%, transparent)',
          }}
        >
          <span className="text-muted-foreground">{filter.label}:</span>
          <span className="font-semibold">
            {formatFilterValue
              ? formatFilterValue(filter.key, value)
              : optionLabel(filter, value)}
          </span>
          <button
            type="button"
            onClick={() => onFilterChange?.(filter.key, null)}
            aria-label={`Remove ${filter.label} filter`}
            className="grid size-4 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onClearFilters?.()}
        className="ml-0.5 text-xs font-semibold text-primary hover:underline"
      >
        Clear all
      </button>
    </>
  );
}
