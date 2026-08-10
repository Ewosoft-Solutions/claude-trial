'use client';

/* ============================================================
   DirectoryTable — the governed directory surface (F7)

   ONE reusable, server-driven table every entity list reuses, killing
   the per-page bespoke list. It renders whatever rows the tenant +
   permission-filtered projection returns (paging/sorting/filtering all
   happen server-side and live in the URL via `useDirectoryState`), and
   adds the cross-cutting concerns a directory always needs:

     · row selection + a sticky BULK-ACTION BAR
     · sortable column headers (keyboard + `aria-sort`, no colour-only cue)
     · a column-visibility menu
     · integrated loading / empty / error states (custom/states)
     · privacy-aware cells (MaskedValue) — the projection masks the value;
       this only renders the "masked" affordance.

   Presentational + controlled: pagination/sort are props+callbacks so the
   host binds them to the URL. Copy is consumer-supplied. Aurora-token
   styled, themed by the shared primitives (light/dark/classic-dark).
   ============================================================ */

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  Lock,
  X,
} from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Button } from '@workspace/ui/components/button';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import {
  DirectoryFilterPills,
  DirectoryToolbar,
  activeFilterEntries,
  type DirectoryToolbarProps,
  type ToolbarFilter,
  type ToolbarViews,
} from '@workspace/ui/custom/tables/directory-toolbar';
import {
  EmptyState,
  ErrorState,
} from '@workspace/ui/custom/states/page-states';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';
import type { StateActionVariant } from '@workspace/ui/types/states.types';

type Align = 'start' | 'end' | 'center';

const ALIGN_CLASS: Record<Align, string> = {
  start: 'text-left',
  end: 'text-right',
  center: 'text-center',
};

export interface DirectoryColumn<TRow> {
  /** Stable id; doubles as the sort field passed to `onSortChange`. */
  id: string;
  /** Header content (usually a short label). */
  header: React.ReactNode;
  /** Cell renderer for a row. */
  cell: (row: TRow) => React.ReactNode;
  /** Enable the sortable header button (server-side sort). */
  sortable?: boolean;
  /** Cell/header alignment. Defaults to `start`. */
  align?: Align;
  /** Allow hiding via the column-visibility menu. Defaults to true. */
  hideable?: boolean;
  /** Start hidden (user can re-enable from the menu). */
  defaultHidden?: boolean;
  /** Accessible label for the column when `header` is not plain text. */
  ariaLabel?: string;
  className?: string;
}

export interface DirectoryBulkAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: StateActionVariant;
  /** Run against the currently selected row ids. */
  onRun: (selectedIds: string[]) => void | Promise<void>;
  disabled?: boolean;
}

export interface DirectoryTableProps<TRow> {
  columns: DirectoryColumn<TRow>[];
  rows: TRow[];
  getRowId: (row: TRow) => string;
  /** Optional row label for the selection checkbox aria-label. */
  getRowLabel?: (row: TRow) => string;

  /** Total rows across ALL pages (from the server). */
  total: number;
  /** 1-based current page. */
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;

  sort: DirectorySort | null;
  /** Toggle sort for a column id (unsorted -> asc -> desc -> unsorted). */
  onSortChange: (field: string) => void;

  /** Enable row selection + the bulk-action bar. */
  selectable?: boolean;
  bulkActions?: DirectoryBulkAction[];

  /**
   * Make each row activatable (opens a detail view). Clicking the selection
   * checkbox or a sort header never triggers this — only the row body does.
   * Keyboard: the row is focusable and responds to Enter/Space.
   */
  onRowClick?: (row: TRow) => void;

  loading?: boolean;
  /** Error message; when set the table body is replaced by an ErrorState. */
  error?: React.ReactNode;
  onRetry?: () => void;

  /** Title/description above the toolbar. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Toolbar slot (search, filters, saved-view select, primary action).
   *  Legacy path — prefer the structured props below, which render the
   *  built-in Pattern B toolbar (responsive Filters button + applied pills). */
  toolbar?: React.ReactNode;
  /** Applied-filter pills row rendered below the toolbar (legacy path). */
  filterBar?: React.ReactNode;

  // ---- Structured Pattern B toolbar (opt-in via `search`) --------------
  /** Providing `search` switches on the built-in DirectoryToolbar. */
  search?: DirectoryToolbarProps['search'];
  filters?: ToolbarFilter[];
  filterValues?: Record<string, string | null | undefined>;
  onFilterChange?: (key: string, value: string | null) => void;
  onClearFilters?: () => void;
  formatFilterValue?: (key: string, value: string) => string;
  views?: ToolbarViews;
  /**
   * Hidden column ids. Provide together with `onHiddenColumnsChange` to make
   * column visibility CONTROLLED — e.g. bound to the URL via `useDirectoryState`
   * so a SavedView / shared link can capture and replay which columns are shown.
   * Omit both for the default uncontrolled behaviour (internal state seeded from
   * each column's `defaultHidden`).
   */
  hiddenColumns?: string[];
  onHiddenColumnsChange?: (hiddenColumns: string[]) => void;
  /** Inline actions (e.g. a primary button) placed at the toolbar's end. */
  toolbarActions?: React.ReactNode;
  /** Actions rendered on the title line instead of in the toolbar row — frees
   *  the search box to take the full width on mobile. */
  headerActions?: React.ReactNode;
  /** Empty-state slot (defaults to a generic EmptyState). */
  emptyState?: React.ReactNode;
  /** Accessible caption for the table. */
  caption?: string;
  className?: string;
}

export function DirectoryTable<TRow>({
  columns,
  rows,
  getRowId,
  getRowLabel,
  total,
  page,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  sort,
  onSortChange,
  selectable = false,
  bulkActions = [],
  onRowClick,
  loading = false,
  error,
  onRetry,
  title,
  description,
  toolbar,
  filterBar,
  search,
  filters,
  filterValues,
  onFilterChange,
  onClearFilters,
  formatFilterValue,
  views,
  hiddenColumns,
  onHiddenColumnsChange,
  toolbarActions,
  headerActions,
  emptyState,
  caption,
  className,
}: DirectoryTableProps<TRow>) {
  // ---- Column visibility ------------------------------------------------
  // Uncontrolled by default (internal state seeded from `defaultHidden`).
  // Becomes CONTROLLED when the host passes `hiddenColumns` (e.g. bound to the
  // URL via useDirectoryState so a SavedView can capture + replay it).
  const [internalHidden, setInternalHidden] = React.useState<string[]>(() =>
    columns.filter((c) => c.defaultHidden).map((c) => c.id),
  );
  const isColumnsControlled = hiddenColumns !== undefined;
  const hiddenIds = isColumnsControlled ? hiddenColumns : internalHidden;
  const hiddenSet = new Set(hiddenIds);
  const commitHidden = (next: string[]) => {
    onHiddenColumnsChange?.(next);
    if (!isColumnsControlled) setInternalHidden(next);
  };
  const setColumnVisible = (id: string, visible: boolean) => {
    const next = new Set(hiddenIds);
    if (visible) next.delete(id);
    else next.add(id);
    commitHidden([...next]);
  };
  const visibleColumns = columns.filter((c) => !hiddenSet.has(c.id));

  // ---- Selection (internal; scoped to the current page) -----------------
  const rowIds = React.useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // A new page / filter result invalidates the current selection.
  const rowIdKey = rowIds.join('|');
  React.useEffect(() => {
    setSelected(new Set());
  }, [rowIdKey]);

  const selectedOnPage = rowIds.filter((id) => selected.has(id));
  const allSelected =
    rowIds.length > 0 && selectedOnPage.length === rowIds.length;
  const someSelected = selectedOnPage.length > 0 && !allSelected;

  const toggleAll = React.useCallback(
    (checked: boolean) => {
      setSelected(checked ? new Set(rowIds) : new Set());
    },
    [rowIds],
  );
  const toggleRow = React.useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const clearSelection = React.useCallback(() => setSelected(new Set()), []);

  const [runningAction, setRunningAction] = React.useState<string | null>(null);
  const runBulk = React.useCallback(
    async (action: DirectoryBulkAction) => {
      setRunningAction(action.id);
      try {
        await action.onRun(selectedOnPage);
      } finally {
        setRunningAction(null);
      }
    },
    [selectedOnPage],
  );

  // ---- Pagination arithmetic -------------------------------------------
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const firstRow = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastRow = Math.min(total, currentPage * pageSize);

  const isEmpty = !loading && !error && rows.length === 0;
  const hideableColumns = columns.filter((c) => c.hideable !== false);
  const anyHidden = hideableColumns.some((c) => hiddenSet.has(c.id));
  const anyVisible = hideableColumns.some((c) => !hiddenSet.has(c.id));
  const showAllColumns = () => commitHidden([]);
  const hideAllColumns = () => commitHidden(hideableColumns.map((c) => c.id));
  const colSpan = visibleColumns.length + (selectable ? 1 : 0);

  const sortState = (columnId: string): 'ascending' | 'descending' | 'none' => {
    if (sort?.field !== columnId) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <DataTableLayout
      className={className}
      title={title}
      description={description}
      headerActions={headerActions}
      loading={loading}
      empty={isEmpty || Boolean(error)}
      emptyState={
        error ? (
          <ErrorState
            compact
            title="Couldn't load this list"
            description={typeof error === 'string' ? error : undefined}
            primaryAction={
              onRetry ? { label: 'Retry', onClick: onRetry } : undefined
            }
          />
        ) : (
          (emptyState ?? (
            <EmptyState
              compact
              title="Nothing to show"
              description="No records match the current view."
            />
          ))
        )
      }
      filterBar={
        search ? (
          activeFilterEntries(filters, filterValues).length > 0 ? (
            <DirectoryFilterPills
              filters={filters}
              filterValues={filterValues}
              onFilterChange={onFilterChange}
              onClearFilters={onClearFilters}
              formatFilterValue={formatFilterValue}
            />
          ) : undefined
        ) : (
          filterBar
        )
      }
      toolbar={
        search ? (
          <DirectoryToolbar
            search={search}
            filters={filters}
            filterValues={filterValues}
            onFilterChange={onFilterChange}
            onClearFilters={onClearFilters}
            views={views}
            actions={toolbarActions}
            columns={
              hideableColumns.length > 0
                ? {
                    items: hideableColumns.map((c) => ({
                      id: c.id,
                      label:
                        c.ariaLabel ??
                        (typeof c.header === 'string' ? c.header : c.id),
                      visible: !hiddenSet.has(c.id),
                    })),
                    onToggle: setColumnVisible,
                  }
                : undefined
            }
          />
        ) : (
          <>
            {toolbar}
            {hideableColumns.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Columns3 aria-hidden />
                    <span className="hidden @md/main:inline">Columns</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!anyHidden}
                    onSelect={(e) => {
                      e.preventDefault();
                      showAllColumns();
                    }}
                  >
                    Show all
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!anyVisible}
                    onSelect={(e) => {
                      e.preventDefault();
                      hideAllColumns();
                    }}
                  >
                    Hide all
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {hideableColumns.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={!hiddenSet.has(c.id)}
                      onCheckedChange={(value) =>
                        setColumnVisible(c.id, value === true)
                      }
                    >
                      {c.ariaLabel ??
                        (typeof c.header === 'string' ? c.header : c.id)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        )
      }
      footer={
        <>
          <span aria-live="polite">
            {total === 0 ? (
              'No results'
            ) : (
              <>
                Showing{' '}
                <strong className="text-foreground tabular-nums">
                  {firstRow}–{lastRow}
                </strong>{' '}
                of <span className="tabular-nums">{total}</span>
              </>
            )}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span className="hidden sm:inline">Rows</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => onPageSizeChange(Number(v))}
              >
                <SelectTrigger
                  className="h-8 w-[4.5rem] rounded-sm"
                  style={{ backgroundColor: 'transparent' }}
                  aria-label="Rows per page"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <span className="tabular-nums">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <span className="sr-only">Previous page</span>
                <ChevronLeft aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <span className="sr-only">Next page</span>
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>
        </>
      }
    >
      {selectable && selectedOnPage.length > 0 ? (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-4 py-2 text-sm sm:px-6"
        >
          <span className="font-semibold text-foreground tabular-nums">
            {selectedOnPage.length} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.id}
                size="sm"
                variant={action.variant ?? 'outline'}
                disabled={action.disabled || runningAction !== null}
                onClick={() => runBulk(action)}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
              aria-label="Clear selection"
            >
              <X aria-hidden />
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <Table>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <TableHeader>
          <TableRow>
            {selectable ? (
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? 'indeterminate' : false
                  }
                  onCheckedChange={(v) => toggleAll(v === true)}
                  aria-label="Select all rows on this page"
                />
              </TableHead>
            ) : null}
            {visibleColumns.map((col) => {
              const aligned = ALIGN_CLASS[col.align ?? 'start'];
              if (!col.sortable) {
                return (
                  <TableHead
                    key={col.id}
                    className={cn(aligned, col.className)}
                    aria-label={col.ariaLabel}
                  >
                    {col.header}
                  </TableHead>
                );
              }
              const state = sortState(col.id);
              const SortIcon =
                state === 'ascending'
                  ? ArrowUp
                  : state === 'descending'
                    ? ArrowDown
                    : ChevronsUpDown;
              return (
                <TableHead
                  key={col.id}
                  aria-sort={state}
                  className={cn(aligned, col.className)}
                >
                  <button
                    type="button"
                    onClick={() => onSortChange(col.id)}
                    className={cn(
                      // `uppercase` here is deliberate: browsers' form reset
                      // (Tailwind Preflight) sets text-transform:none on
                      // <button>, which would otherwise cancel the uppercase
                      // inherited from the <th>.
                      'inline-flex items-center gap-1 rounded-sm font-semibold uppercase tracking-wider hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      col.align === 'end' && 'flex-row-reverse',
                    )}
                  >
                    {col.header}
                    <SortIcon
                      aria-hidden
                      className={cn(
                        'size-3.5 shrink-0',
                        state === 'none' && 'text-muted-foreground/60',
                      )}
                    />
                    <span className="sr-only">
                      {state === 'none'
                        ? ', not sorted, activate to sort ascending'
                        : state === 'ascending'
                          ? ', sorted ascending, activate to sort descending'
                          : ', sorted descending, activate to clear sort'}
                    </span>
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const id = getRowId(row);
            const isSelected = selected.has(id);
            const clickable = Boolean(onRowClick);
            return (
              <TableRow
                key={id}
                data-state={isSelected ? 'selected' : undefined}
                className={cn(clickable && 'cursor-pointer')}
                tabIndex={clickable ? 0 : undefined}
                aria-label={
                  clickable && getRowLabel
                    ? `View ${getRowLabel(row)}`
                    : undefined
                }
                onClick={clickable ? () => onRowClick?.(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        // Only when the row itself is focused — never when the
                        // event bubbled up from the checkbox or a cell control.
                        if (
                          e.target === e.currentTarget &&
                          (e.key === 'Enter' || e.key === ' ')
                        ) {
                          e.preventDefault();
                          onRowClick?.(row);
                        }
                      }
                    : undefined
                }
              >
                {selectable ? (
                  <TableCell
                    className="w-10"
                    // Selecting a row must never open the detail view.
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(v) => toggleRow(id, v === true)}
                      aria-label={
                        getRowLabel
                          ? `Select ${getRowLabel(row)}`
                          : 'Select row'
                      }
                    />
                  </TableCell>
                ) : null}
                {visibleColumns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      ALIGN_CLASS[col.align ?? 'start'],
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="h-20 text-center text-muted-foreground"
              >
                No results.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </DataTableLayout>
  );
}

/* ------------------------------------------------------------------ */

export interface MaskedValueProps {
  /** The (possibly already-masked) value from the projection. */
  value: React.ReactNode;
  /** True when the projection redacted the value (caller lacks the PII scope). */
  masked?: boolean;
  className?: string;
}

/**
 * Render a contact/PII cell, adding a lock affordance + screen-reader note
 * when the value arrived masked. Masking itself is a SERVER concern — the
 * projection sends the redacted string; this never has the real value.
 */
export function MaskedValue({
  value,
  masked = false,
  className,
}: MaskedValueProps) {
  if (!masked) return <span className={className}>{value}</span>;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-muted-foreground',
        className,
      )}
      title="Hidden — you don't have permission to view this contact detail"
    >
      <Lock aria-hidden className="size-3 shrink-0" />
      <span>{value}</span>
      <span className="sr-only">(masked, permission required)</span>
    </span>
  );
}
