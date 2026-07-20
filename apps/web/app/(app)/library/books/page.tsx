/* ============================================================
   /library/books — catalog (server component)

   Fetches catalog copies from the NestJS backend (server-side,
   cookie-authenticated) and passes them to BooksClient.
   Empty API responses render as empty states in the client.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { BooksClient, type Book, type BookStatus } from './books-client';

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(iso));
  } catch {
    return null;
  }
}

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

export default async function BooksPage() {
  const data = await serverApiGet<ApiBook[] | { data?: ApiBook[] }>('/library/books');

  const raw: ApiBook[] = Array.isArray(data) ? data : (data as { data?: ApiBook[] } | null)?.data ?? [];

  const books: Book[] = raw.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    category: b.category,
    status: b.status,
    borrower: b.student ? `${b.student.userTenant.user.firstName} ${b.student.userTenant.user.lastName}` : null,
    dueDate: formatDate(b.dueDate),
  }));

  return <BooksClient books={books} />;
}
