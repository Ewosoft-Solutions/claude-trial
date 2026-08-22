/* ============================================================
   /library/books — catalog (server component)

   Server-driven list: page / search / status filter / sort all run at the DB
   (via the URL, read here and forwarded to the paginated `/library/books`
   endpoint). Stat tiles come from the whole-catalog `/library/books/summary`,
   so they stay accurate regardless of the current page or filter.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { toListQuery } from '@/lib/list-query';
import { DEFAULT_PAGE_SIZE } from '@/lib/page-size';
import {
  BooksClient,
  type Book,
  type BookStatus,
  type CatalogStats,
} from './books-client';

interface ApiBook {
  id: string;
  title: string;
  author: string;
  category: string | null;
  status: BookStatus;
  dueDate: string | null;
  student: {
    userTenant: { user: { firstName: string; lastName: string } };
  } | null;
}

interface BooksResponse {
  data: ApiBook[];
  pagination: { total: number };
}

interface CatalogSummary {
  totalBooks: number;
  statusCounts: Record<string, number>;
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { params } = toListQuery(sp, {
    defaultPageSize: DEFAULT_PAGE_SIZE,
    filters: { status: 'status', category: 'category' },
  });

  const [list, summary] = await Promise.all([
    serverApiGet<BooksResponse>(`/library/books?${params.toString()}`),
    serverApiGet<CatalogSummary>('/library/books/summary'),
  ]);

  const raw = list?.data ?? [];
  const books: Book[] = raw.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    category: b.category,
    status: b.status,
    borrower: b.student
      ? `${b.student.userTenant.user.firstName} ${b.student.userTenant.user.lastName}`
      : null,
    dueDate: formatDate(b.dueDate),
  }));

  const counts = summary?.statusCounts ?? {};
  const stats: CatalogStats = {
    total: summary?.totalBooks ?? 0,
    available: counts.available ?? 0,
    onLoan: counts.on_loan ?? 0,
    overdue: counts.overdue ?? 0,
  };

  return (
    <BooksClient
      books={books}
      total={list?.pagination.total ?? 0}
      defaultPageSize={DEFAULT_PAGE_SIZE}
      stats={stats}
    />
  );
}
