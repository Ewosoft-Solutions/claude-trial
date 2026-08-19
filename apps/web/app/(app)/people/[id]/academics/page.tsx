import { getPersonDetail } from '../get-detail';
import { PersonProfileShell, ProfileMissing } from '../profile-shell';
import { Section, StatTiles } from '../../person-detail-ui';
import { humanize } from '../../person-detail.types';

export default async function PersonAcademicsPage({
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

  const a = detail.academics;

  return (
    <PersonProfileShell
      detail={detail}
      activeTab="academics"
      type={type ?? 'all'}
    >
      {!a ? (
        <p className="text-sm text-muted-foreground">
          No academics to show for this person.
        </p>
      ) : (
        <div className="@container/tiles flex flex-col gap-6">
          <StatTiles
            items={[
              {
                key: 'att',
                label: 'Attendance',
                value:
                  a.attendancePercent != null ? `${a.attendancePercent}%` : '—',
                tone:
                  a.attendancePercent != null && a.attendancePercent < 85
                    ? 'warning'
                    : undefined,
              },
              {
                key: 'grade',
                label: 'Avg grade',
                value:
                  a.averageGradePercent != null
                    ? `${a.averageGradePercent}%`
                    : '—',
              },
              {
                key: 'classes',
                label: 'Classes',
                value: a.currentClasses.length,
              },
            ]}
          />

          <Section title="Classes">
            {a.currentClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No class enrolments.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {a.currentClasses.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground">
                        {c.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[c.term, humanize(c.status)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    {c.finalGrade ? (
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {c.finalGrade}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </PersonProfileShell>
  );
}
