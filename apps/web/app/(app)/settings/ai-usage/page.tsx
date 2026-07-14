import { serverApiGet } from '@/lib/server-api';
import {
  AiSettingsClient,
  type AiSettings,
  type PendingChange,
} from './ai-settings-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { Meter } from '@workspace/ui/custom/data-display/meter';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import type { StateTone } from '@workspace/ui/types/states.types';
import { DataCard } from '../../_shared/data-card';

interface AiUsageSummary {
  month: string;
  settings: {
    modelTier: string;
    analyticsEnabled: boolean;
    tutorEnabled: boolean;
    monthlyTokenBudget: number;
    concurrencyLimit: number;
    alertThresholdPercent: number;
    byokProvider: string | null;
    keyLast4: string | null;
  };
  usage: {
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    totalTokens: number;
    remainingTokens: number;
    percentUsed: number;
    alertSentAt: string | null;
  };
  concurrency: {
    activeRequests: number;
    limit: number;
  };
  features: Array<{
    feature: 'analytics' | 'tutor';
    requestCount: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    totalTokens: number;
    percentOfTotal: number;
    lastProvider: string | null;
    lastModel: string | null;
    lastUsedAt: string | null;
    alertSentAt: string | null;
  }>;
}

const number = new Intl.NumberFormat('en-US');

function usageTone(percent: number): StateTone {
  if (percent >= 100) return 'destructive';
  if (percent >= 80) return 'warning';
  return 'success';
}

function featureLabel(feature: string): string {
  return feature === 'tutor' ? 'Study tutor' : 'Analytics chat';
}

function formatDate(value: string | null): string {
  if (!value) return 'No activity';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No activity';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default async function AiUsageSettingsPage() {
  const [summary, settings, pending] = await Promise.all([
    serverApiGet<AiUsageSummary>('/ai/admin/usage'),
    serverApiGet<AiSettings>('/ai/admin/settings'),
    serverApiGet<PendingChange[]>('/ai/admin/settings/change-requests'),
  ]);

  if (!summary) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">AI usage</CardTitle>
          <CardDescription>
            Monthly AI quota, active request limits, and feature usage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            compact
            title="AI usage unavailable"
            description="Usage data will appear here for users with AI configuration access."
          />
        </CardContent>
      </Card>
    );
  }

  const tone = usageTone(summary.usage.percentUsed);

  return (
    <div className="flex flex-col gap-4">
      <Card className="shadow-card">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <CardTitle className="text-base">AI usage</CardTitle>
              <CardDescription>
                {summary.month} quota and request activity for this school.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge tone={summary.settings.analyticsEnabled ? 'success' : 'neutral'} dot>
                Analytics
              </StatusBadge>
              <StatusBadge tone={summary.settings.tutorEnabled ? 'success' : 'neutral'} dot>
                Tutor
              </StatusBadge>
              <StatusBadge tone="info">
                {summary.settings.modelTier}
              </StatusBadge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 @5xl/main:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
          <div className="flex flex-col gap-3">
            <Meter
              label="Monthly token quota"
              value={summary.usage.totalTokens}
              max={summary.settings.monthlyTokenBudget}
              tone={tone}
              valueLabel={`${number.format(summary.usage.totalTokens)} / ${number.format(summary.settings.monthlyTokenBudget)} tokens`}
            />
            <div className="grid gap-3 @3xl/main:grid-cols-3">
              <Metric label="Remaining" value={number.format(summary.usage.remainingTokens)} />
              <Metric label="Requests" value={number.format(summary.usage.requestCount)} />
              <Metric
                label="Active now"
                value={`${number.format(summary.concurrency.activeRequests)} / ${number.format(summary.concurrency.limit)}`}
              />
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Cost controls
            </div>
            <dl className="mt-3 grid gap-2 text-sm">
              <SummaryItem label="Alert threshold" value={`${summary.settings.alertThresholdPercent}%`} />
              <SummaryItem
                label="BYOK provider"
                value={summary.settings.byokProvider ?? 'Platform key'}
              />
              <SummaryItem
                label="Key ending"
                value={summary.settings.keyLast4 ? `...${summary.settings.keyLast4}` : 'Not configured'}
              />
            </dl>
          </div>
        </CardContent>
      </Card>

      <DataCard
        title="Feature usage"
        count={summary.features.length}
        unit="feature"
        description="Token totals are recorded after each completed assistant response."
      >
        {summary.features.length === 0 ? (
          <EmptyState
            compact
            title="No AI usage this month"
            description="Analytics chat and study tutor activity will appear here as members use AI."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead className="text-right">Requests</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="max-md:hidden">Model</TableHead>
                <TableHead>Last used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.features.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="font-medium">
                    {featureLabel(row.feature)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {number.format(row.requestCount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {number.format(row.totalTokens)}
                  </TableCell>
                  <TableCell className="max-md:hidden text-muted-foreground">
                    {row.lastModel ?? 'Unknown'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.lastUsedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataCard>

      {settings ? (
        <AiSettingsClient settings={settings} pending={pending ?? []} />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
