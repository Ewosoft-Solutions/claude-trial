import { FileText } from 'lucide-react';

import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { Separated } from '@workspace/ui/custom/data-display/dot';

import { getPersonDetail } from '../get-detail';
import { Section } from '../../person-detail-ui';
import { formatDate, humanize } from '../../person-detail.types';

export default async function PersonDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPersonDetail(id);
  // The layout already showed `ProfileMissing` in this case.
  if (!detail) return null;

  const docs = detail.documents;

  return !docs || docs.count === 0 ? (
    <p className="text-sm text-muted-foreground">
      No documents on file (or you lack permission).
    </p>
  ) : (
    <Section title={`Documents (${docs.count})`}>
      <div className="flex flex-col gap-1.5">
        {docs.recent.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
          >
            <FileText
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground">
                {d.title}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                <Separated
                  text={[d.type, formatDate(d.createdAt)]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </div>
            </div>
            <StatusBadge
              tone={d.scanStatus === 'clean' ? 'success' : 'neutral'}
              dot
            >
              {humanize(d.scanStatus)}
            </StatusBadge>
          </div>
        ))}
      </div>
    </Section>
  );
}
