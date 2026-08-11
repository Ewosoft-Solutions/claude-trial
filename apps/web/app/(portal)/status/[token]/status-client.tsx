'use client';

/**
 * Applicant status portal — track the journey + complete the online steps
 * (upload required documents, accept an offer), all with just the SecureLink
 * token (no login). Reuses the shared design-system detail primitives.
 */
import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, Upload } from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import {
  Section,
  StatTiles,
} from '@workspace/ui/custom/detail/detail-primitives';

import {
  COLLECT_STAGE_LABEL,
  REQUIREMENT_STATUS_TONE,
  STAGE_STEP_LABEL,
  STAGE_TONE,
  errorMessage,
  fileToBase64,
  fmtDate,
  titleCase,
  type StatusRequirement,
  type StatusView,
} from '../../portal-types';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function StatusClient({ token }: { token: string }) {
  const [status, setStatus] = React.useState<StatusView | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [accepting, setAccepting] = React.useState(false);

  const base = `/api/public/admissions/status/${encodeURIComponent(token)}`;

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(base, { cache: 'no-store' });
      if (!res.ok) {
        setError(true);
        return;
      }
      setStatus((await res.json()) as StatusView);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [base]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function accept() {
    setAccepting(true);
    try {
      const res = await fetch(`${base}/accept`, { method: 'POST' });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Could not accept the offer'));
        return;
      }
      setStatus((await res.json()) as StatusView);
      toast.success('Offer accepted');
    } catch {
      toast.error('Network error — please try again.');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !status) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <h1 className="text-lg font-semibold">Link not found</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This tracking link is invalid or has expired. Please check the link
            or contact the school.
          </p>
        </CardContent>
      </Card>
    );
  }

  const outstanding = status.requirements.filter((r) => r.status === 'pending');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-primary">
          Application status
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{status.applicantName}</h1>
          <StatusBadge tone={STAGE_TONE[status.stage] ?? 'neutral'}>
            {STAGE_STEP_LABEL[status.stage] ?? titleCase(status.stage)}
          </StatusBadge>
        </div>
        <p className="text-sm text-muted-foreground">
          Applying for {status.applyingFor} · submitted{' '}
          {fmtDate(status.submittedDate)}
        </p>
      </header>

      {status.stage === 'offer' && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="text-base">
              You&apos;ve been offered a place
            </CardTitle>
            <CardDescription>
              Accept the offer to confirm the place. Complete any outstanding
              requirements below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void accept()} disabled={accepting}>
              {accepting ? 'Accepting…' : 'Accept offer'}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="@container/tiles">
        <StatTiles
          items={[
            {
              key: 'stage',
              label: 'Stage',
              value: STAGE_STEP_LABEL[status.stage] ?? titleCase(status.stage),
            },
            {
              key: 'outstanding',
              label: 'To do',
              value: outstanding.length,
              tone: outstanding.length > 0 ? 'warning' : undefined,
            },
            {
              key: 'ref',
              label: 'Reference',
              value: (
                <span className="font-mono text-xs">
                  {status.reference.slice(0, 8)}
                </span>
              ),
            },
          ]}
        />
      </div>

      <Section title="Requirements">
        {status.requirements.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to provide right now.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {status.requirements.map((r) => (
              <RequirementRow
                key={r.id}
                requirement={r}
                base={base}
                onDone={load}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="Progress">
        {status.stageHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No updates yet.</p>
        ) : (
          <ol className="flex flex-col">
            {status.stageHistory.map((e, i) => (
              <li key={`${e.toStage}-${i}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'mt-0.5 size-3 shrink-0 rounded-full border-2',
                      i === status.stageHistory.length - 1
                        ? 'border-primary bg-primary'
                        : 'border-border bg-background',
                    )}
                  />
                  {i < status.stageHistory.length - 1 ? (
                    <span className="my-0.5 w-px flex-1 bg-border" />
                  ) : null}
                </div>
                <div className="min-w-0 pb-4">
                  <div className="text-sm font-medium text-foreground">
                    {STAGE_STEP_LABEL[e.toStage] ?? titleCase(e.toStage)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(e.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function RequirementRow({
  requirement: r,
  base,
  onDone,
}: {
  requirement: StatusRequirement;
  base: string;
  onDone: () => Promise<void> | void;
}) {
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const isDocument = r.type === 'document';

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error('File is too large (max 10 MB).');
      return;
    }
    setBusy(true);
    try {
      const contentBase64 = await fileToBase64(file);
      const res = await fetch(`${base}/requirements/${r.id}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mime: file.type || 'application/octet-stream',
          filename: file.name,
          contentBase64,
        }),
      });
      if (!res.ok) {
        toast.error(await errorMessage(res, 'Upload failed'));
        return;
      }
      toast.success('Uploaded');
      await onDone();
    } catch {
      toast.error('Could not read the file — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 p-2.5 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">
          {r.label}
          {r.required && <span className="ml-1 text-destructive">*</span>}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {COLLECT_STAGE_LABEL[r.collectStage] ?? r.collectStage}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge tone={REQUIREMENT_STATUS_TONE[r.status] ?? 'neutral'}>
          {r.status}
        </StatusBadge>
        {isDocument && r.status === 'pending' && (
          <>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 size-3.5" aria-hidden /> Upload
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
