/* ============================================================
   /library/loans — books on loan (server component)

   Books currently checked out, with borrower, due date, and an
   overdue flag. Data comes from the NestJS GET /library/loans view.
   ============================================================ */

import { serverApiGet } from '@/lib/server-api';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { DataCard } from '../../_shared/data-card';

interface Loan {
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

export default async function LibraryLoansPage() {
  const loans = (await serverApiGet<Loan[]>('/library/loans')) ?? [];
  const overdue = loans.filter((l) => l.overdue).length;

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Loans"
          description="Books currently on loan, soonest due first."
        />
        <DataCard
          title="On loan"
          count={loans.length}
          unit="loan"
          description={`${loans.length} on loan · ${overdue} overdue`}
        >
          {loans.length === 0 ? (
            <EmptyState
              compact
              title="Nothing on loan"
              description="Checked-out books appear here with their borrower and due date."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Title</TableHead>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Copy</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-6">
                      <div className="flex min-w-0 flex-col">
                        <span className="break-words font-medium text-foreground">
                          {l.title}
                        </span>
                        <span className="break-words text-xs text-muted-foreground">
                          {l.author}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {l.borrower ? (
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
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.copyLabel ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatDate(l.dueDate)}
                    </TableCell>
                    <TableCell className="pr-6">
                      <StatusBadge tone={l.overdue ? 'destructive' : 'info'} dot>
                        {l.overdue ? 'Overdue' : 'On loan'}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DataCard>
      </div>
    </ShellMain>
  );
}
