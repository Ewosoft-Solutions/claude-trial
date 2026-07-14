'use client';

/* ============================================================
   BooksClient — library catalog interactive table

   Receives server-fetched catalog copies as props. M6 StatGrid (catalog
   summary) + DataTableLayout (toolbar + table + footer). Circulation status
   reads as a StatusBadge.
   ============================================================ */

import * as React from 'react';
import { BookPlus, Search } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
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
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { DataTableLayout } from '@workspace/ui/custom/layouts/data-table-layout';
import { StatGrid } from '@workspace/ui/custom/layouts/stat-grid';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
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

const STATUS_META: Record<BookStatus, { label: string; tone: StateTone }> = {
  available: { label: 'Available', tone: 'success' },
  on_loan: { label: 'On loan', tone: 'info' },
  reserved: { label: 'Reserved', tone: 'warning' },
  overdue: { label: 'Overdue', tone: 'destructive' },
};

const META: PageHeaderMeta[] = [{ key: 'term', label: 'Spring Term 2025', emphasis: true }];

interface Props {
  books: Book[];
}

export function BooksClient({ books }: Props) {
  const BOOKS = books;
  const loading = false;

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return BOOKS.filter((b) => {
      const matchesQuery =
        !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [BOOKS, query, statusFilter]);

  const hasFilters = query.trim() !== '' || statusFilter !== 'all';
  function resetFilters() {
    setQuery('');
    setStatusFilter('all');
  }

  const stats: StatItem[] = React.useMemo(() => {
    const count = (fn: (b: Book) => boolean) => BOOKS.filter(fn).length;
    return [
      { key: 'total', label: 'Catalog copies', value: String(BOOKS.length) },
      { key: 'available', label: 'Available', value: String(count((b) => b.status === 'available')) },
      { key: 'on_loan', label: 'On loan', value: String(count((b) => b.status === 'on_loan')) },
      { key: 'overdue', label: 'Overdue', value: String(count((b) => b.status === 'overdue')) },
    ];
  }, [BOOKS]);

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

        <StatGrid items={stats} />

        <DataTableLayout
          title="Catalog"
          description={
            loading ? 'Loading catalog…' : `${filtered.length} of ${BOOKS.length} copies`
          }
          loading={loading}
          empty={!loading && filtered.length === 0}
          skeletonColumns={5}
          toolbar={
            <>
              <div className="relative flex-1 min-w-0 @md/main:w-56 @md/main:flex-none">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Label htmlFor="book-search" className="sr-only">
                  Search books
                </Label>
                <Input
                  id="book-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title or author…"
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[10rem]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="on_loan">On loan</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          emptyState={
            <EmptyState
              compact
              title={hasFilters ? 'No books match your filters' : 'No library books yet'}
              description={
                hasFilters
                  ? 'Try a different search term, or clear the filters.'
                  : 'Run the dev operational seed or add a catalog copy.'
              }
              primaryAction={
                hasFilters ? { label: 'Clear filters', onClick: resetFilters } : undefined
              }
            />
          }
          footer={
            <>
              <span>
                Showing <strong className="text-foreground">{filtered.length}</strong> of{' '}
                {BOOKS.length}
              </span>
              {hasFilters ? (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null}
            </>
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="max-md:hidden">Category</TableHead>
                <TableHead className="max-sm:hidden">Borrower</TableHead>
                <TableHead className="text-right max-sm:hidden">Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => {
                const status = STATUS_META[b.status];
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-foreground">{b.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{b.author}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-md:hidden">
                      {b.category ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-sm:hidden">
                      {b.borrower ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground max-sm:hidden">
                      {b.dueDate ?? '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={status.tone} dot>
                        {status.label}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataTableLayout>
      </div>
    </ShellMain>
  );
}
