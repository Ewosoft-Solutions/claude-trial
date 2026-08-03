import { FileText } from 'lucide-react';

import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';

import { getPersonDetail } from '../get-detail';
import { PersonProfileShell, ProfileMissing } from '../profile-shell';
import { Section } from '../../person-detail-ui';
import { formatDate, humanize } from '../../person-detail.types';

export default async function PersonDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const detail = await getPersonDetail(id, type);
  if (!detail) return <ProfileMissing />;

  const docs = detail.documents;

  return (
    <PersonProfileShell
      detail={detail}
      activeTab="documents"
      type={type ?? 'all'}
    >
      {!docs || docs.count === 0 ? (
        <p className="text-sm text-muted-foreground">
          No documents on file (or you lack permission).
        </p>
      ) : (
        <Section title={`Documents (${docs.count})`}>
          <div className="flex flex-col gap-1.5">
            {docs.recent.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/40 p-3 text-sm"
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
                    {[d.type, formatDate(d.createdAt)]
                      .filter(Boolean)
                      .join(' · ')}
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
      )}
    </PersonProfileShell>
  );
}
