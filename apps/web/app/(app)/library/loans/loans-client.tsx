'use client';

/* ============================================================
   LoansClient — books on loan (client-side DirectoryTable)

   The server loads the full loans list (the endpoint isn't paginated), so
   search / status + category filters / sort / paging all run in-memory here.
   Because every row is present, nothing is ever hidden past the current page.
   Both filters collapse into the Pattern-B Filters button.
   ============================================================ */

import * as React from 'react';

import {
  DirectoryTable,
  type DirectoryColumn,
} from '@workspace/ui/custom/tables/directory-table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { DirectorySort } from '@workspace/ui/lib/directory-state';

import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';

export interface Loan {
  id: string;
  title: string;
  author: string;
  category: string | null;
  copyLabel: string | null;
  dueDate: string | null;
  overdue: boolean;
  borrower: { name: string; studentNumber: string } | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export function LoansClient({ loans }: { loans: Loan[] }) {
  const [term, setTerm] = React.useState('');
  const [filters, setFilters] = React.useState<
    Record<string, string | null | undefined>
  >({});
  const [sort, setSort] = React.useState<DirectorySort | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(DEFAULT_PAGE_SIZE);

  // Reset to the first page whenever the result set changes.
  React.useEffect(() => setPage(1), [term, filters, pageSize]);

  const categories = React.useMemo(
    () =>
      Array.from(
        new Set(loans.map((l) => l.category).filter(Boolean) as string[]),
      ).sort(),
    [loans],
  );

  const columns: DirectoryColumn<Loan>[] = [
    {
      id: 'title',
      header: 'Title',
      sortable: true,
      cell: (l) => (
        <div className="flex min-w-0 flex-col">
          <span className="break-words font-medium text-foreground">
            {l.title}
          </span>
          <span className="break-words text-xs text-muted-foreground">
            {l.author}
          </span>
        </div>
      ),
    },
    {
      id: 'borrower',
      header: 'Borrower',
      hideable: true,
      cell: (l) =>
        l.borrower ? (
          <div className="flex min-w-0 flex-col">
            <span className="break-words text-foreground">
              {l.borrower.name}
            </span>
            <span className="break-words text-xs text-muted-foreground">
              {l.borrower.studentNumber}
            </span>
          </div>
        ) : (
          '—'
        ),
    },
    {
      id: 'category',
      header: 'Category',
      hideable: true,
      cell: (l) => (
        <span className="text-muted-foreground">{l.category ?? '—'}</span>
      ),
    },
    {
      id: 'copyLabel',
      header: 'Copy',
      hideable: true,
      cell: (l) => (
        <span className="text-muted-foreground">{l.copyLabel ?? '—'}</span>
      ),
    },
    {
      id: 'dueDate',
      header: 'Due',
      align: 'end',
      sortable: true,
      cell: (l) => (
        <span className="tabular-nums text-muted-foreground">
          {formatDate(l.dueDate)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (l) => (
        <StatusBadge tone={l.overdue ? 'destructive' : 'info'} dot>
          {l.overdue ? 'Overdue' : 'On loan'}
        </StatusBadge>
      ),
    },
  ];

  const filtered = React.useMemo(() => {
    const q = term.trim().toLowerCase();
    const status = filters.status;
    const category = filters.category;
    let out = loans.filter((l) => {
      const matchesQ =
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.author.toLowerCase().includes(q) ||
        (l.borrower?.name.toLowerCase().includes(q) ?? false);
      const matchesStatus =
        !status || (status === 'overdue' ? l.overdue : !l.overdue);
      const matchesCategory = !category || l.category === category;
      return matchesQ && matchesStatus && matchesCategory;
    });
    if (sort) {
      const dir = sort.dir === 'desc' ? -1 : 1;
      const value = (l: Loan): string => {
        if (sort.field === 'dueDate') return l.dueDate ?? '';
        if (sort.field === 'status') return l.overdue ? '1' : '0';
        return l.title;
      };
      out = [...out].sort((a, b) => dir * value(a).localeCompare(value(b)));
    }
    return out;
  }, [loans, term, filters, sort]);

  const overdue = loans.filter((l) => l.overdue).length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <DirectoryTable<Loan>
      title="On loan"
      description={`${filtered.length} on loan · ${overdue} overdue`}
      columns={columns}
      rows={pageRows}
      getRowId={(l) => l.id}
      getRowLabel={(l) => l.title}
      total={filtered.length}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
      sort={sort}
      onSortChange={(field) =>
        setSort((cur) =>
          cur?.field !== field
            ? { field, dir: 'asc' }
            : cur.dir === 'asc'
              ? { field, dir: 'desc' }
              : null,
        )
      }
      caption="Books on loan"
      search={{
        value: term,
        onChange: setTerm,
        placeholder: 'Search title, author, borrower…',
        label: 'Search loans',
        id: 'loans-search',
      }}
      filters={[
        {
          key: 'status',
          label: 'Status',
          options: [
            { value: 'on_loan', label: 'On loan' },
            { value: 'overdue', label: 'Overdue' },
          ],
        },
        ...(categories.length > 0
          ? [
              {
                key: 'category',
                label: 'Category',
                options: categories.map((c) => ({ value: c, label: c })),
              },
            ]
          : []),
      ]}
      filterValues={filters}
      onFilterChange={(key, value) =>
        setFilters((f) => ({ ...f, [key]: value }))
      }
      onClearFilters={() => setFilters({})}
      emptyState={
        <EmptyState
          compact
          title={
            term || Object.values(filters).some(Boolean)
              ? 'No loans match your filters'
              : 'Nothing on loan'
          }
          description={
            term || Object.values(filters).some(Boolean)
              ? 'Try a different search term, or clear the filters.'
              : 'Checked-out books appear here with their borrower and due date.'
          }
        />
      }
    />
  );
}
