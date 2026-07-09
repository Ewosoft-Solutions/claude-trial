import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { serverApiGet } from '@/lib/server-api';
import type { StateTone } from '@workspace/ui/types/states.types';

interface AuditEvent {
  id: string;
  actorId?: string | null;
  action?: string | null;
  eventType?: string | null;
  resource?: string | null;
  status?: string | null;
  timestamp?: string | null;
}

interface AuditResponse {
  data?: AuditEvent[];
}

function statusTone(status: string | null | undefined): StateTone {
  const value = String(status ?? '').toLowerCase();
  if (value.includes('fail') || value.includes('denied')) return 'destructive';
  if (value.includes('success') || value.includes('complete')) return 'success';
  return 'info';
}

function formatTime(value: string | null | undefined): string {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default async function AuditSettingsPage() {
  const response = await serverApiGet<AuditResponse>('/audit-logs?limit=20');
  const events = response?.data ?? [];

  return (
    <Card className="shadow-card">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1.5">
          <CardTitle className="text-base">Audit log</CardTitle>
          <CardDescription>Recent activity returned by the audit API</CardDescription>
        </div>
        <Button variant="outline" size="sm">
          Export
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col">
        {events.length === 0 ? (
          <EmptyState
            compact
            title="No audit events found"
            description="Audit entries returned by the API will appear here."
          />
        ) : (
          events.map((event, index) => (
            <div
              key={event.id}
              className={
                'flex flex-wrap items-center gap-x-3 gap-y-1 py-3' +
                (index > 0 ? ' border-t border-border' : '')
              }
            >
              <StatusBadge tone={statusTone(event.status)} dot>
                {event.resource ?? event.eventType ?? 'Audit'}
              </StatusBadge>
              <span className="min-w-0 flex-1 text-sm text-foreground">
                <span className="font-semibold">{event.actorId ?? 'System'}</span>{' '}
                {event.action ?? event.eventType ?? 'recorded an event'}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatTime(event.timestamp)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
