'use client';

/* ============================================================
   BooksClient — library catalog (server-driven table)

   Search / status filter / sort / paging all live in the URL and run at the
   DB via `useDirectoryState` + `DirectoryTable`. The client never filters the
   fetched page in memory, so it can never hide rows past the current page.
   Stat tiles come from the whole-catalog summary passed by the server.
   ============================================================ */

import * as React from 'react';
import { BookPlus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@workspace/ui/components/button';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { useDirectoryState } from '@workspace/ui/hooks/use-directory-state';
import type { StateTone } from '@workspace/ui/types/states.types';
import type { StatItem } from '@workspace/ui/types/layout.types';
import type { PageHeaderMeta } from '@workspace/ui/types/shell.types';

export type BookStatus = 'available' | 'on_loan' | 'reserved' | 'overdue';

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string | null;
  status: BookStatus;
  borrower: string | null;
  dueDate: string | null;
}

export interface CatalogStats {
  total: number;
  available: number;
  onLoan: number;
  overdue: number;
}

const STATUS_META: Record<BookStatus, { label: string; tone: StateTone }> = {
  available: { label: 'Available', tone: 'success' },
  on_loan: { label: 'On loan', tone: 'info' },
  reserved: { label: 'Reserved', tone: 'warning' },
  overdue: { label: 'Overdue', tone: 'destructive' },
};

const STATUS_FILTER_OPTIONS = (Object.keys(STATUS_META) as BookStatus[]).map(
  (s) => ({ value: s, label: STATUS_META[s].label }),
);

const META: PageHeaderMeta[] = [
  { key: 'term', label: 'Spring Term 2025', emphasis: true },
];

interface Props {
  books: Book[];
  total: number;
  defaultPageSize: number;
  stats: CatalogStats;
}

export function BooksClient({ books, total, defaultPageSize, stats }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = React.useCallback(
    (qs: string) => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const defaults = React.useMemo(
    () => ({ pageSize: defaultPageSize }),
    [defaultPageSize],
  );
  const {
    state,
    setPage,
    setPageSize,
    toggleSort,
    setQuery,
    setFilter,
    setFilters,
  } = useDirectoryState({
    searchParams: searchParams.toString(),
    onChange,
    defaults,
  });

  // Debounced search: snappy typing without a request per keystroke.
  const [term, setTerm] = React.useState(state.q);
  React.useEffect(() => setTerm(state.q), [state.q]);
  React.useEffect(() => {
    if (term === state.q) return;
    const id = setTimeout(() => setQuery(term), 300);
    return () => clearTimeout(id);
  }, [term, state.q, setQuery]);

  const statusFilter = state.filters.status ?? 'all';
  const hasFilters = state.q.trim() !== '' || statusFilter !== 'all';

  const statItems: StatItem[] = [
    { key: 'total', label: 'Catalog copies', value: String(stats.total) },
    { key: 'available', label: 'Available', value: String(stats.available) },
    { key: 'on_loan', label: 'On loan', value: String(stats.onLoan) },
    { key: 'overdue', label: 'Overdue', value: String(stats.overdue) },
  ];

  const columns: DirectoryColumn<Book>[] = [
    {
      id: 'title',
      header: 'Title',
      sortable: true,
      cell: (b) => (
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-medium text-foreground">
            {b.title}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {b.author}
          </span>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      hideable: true,
      cell: (b) => (
        <span className="text-muted-foreground">{b.category ?? '—'}</span>
      ),
    },
    {
      id: 'borrower',
      header: 'Borrower',
      hideable: true,
      cell: (b) => (
        <span className="text-muted-foreground">{b.borrower ?? '—'}</span>
      ),
    },
    {
      id: 'dueDate',
      header: 'Due',
      align: 'end',
      sortable: true,
      cell: (b) => (
        <span className="tabular-nums text-muted-foreground">
          {b.dueDate ?? '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (b) => {
        const meta = STATUS_META[b.status];
        return (
          <StatusBadge tone={meta.tone} dot>
            {meta.label}
          </StatusBadge>
        );
      },
    },
  ];

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Library"
          meta={META}
          actions={
            <Button size="sm">
              <BookPlus /> Add book
            </Button>
          }
        />

        <StatGrid items={statItems} />

        <DirectoryTable<Book>
          columns={columns}
          rows={books}
          getRowId={(b) => b.id}
          getRowLabel={(b) => b.title}
          total={total}
          page={state.page}
          pageSize={state.pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          sort={state.sort}
          onSortChange={toggleSort}
          title="Catalog"
          description={`${total} ${total === 1 ? 'copy' : 'copies'}`}
          caption="Library catalog"
          search={{
            value: term,
            onChange: setTerm,
            placeholder: 'Search title or author…',
            label: 'Search books',
            id: 'book-search',
          }}
          filters={[
            { key: 'status', label: 'Status', options: STATUS_FILTER_OPTIONS },
          ]}
          filterValues={state.filters}
          onFilterChange={setFilter}
          onClearFilters={() => setFilters({})}
          emptyState={
            <EmptyState
              compact
              title={
                hasFilters
                  ? 'No books match your filters'
                  : 'No library books yet'
              }
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Run the dev operational seed or add a catalog copy.'
              }
            />
          }
        />
      </div>
    </ShellMain>
  );
}
