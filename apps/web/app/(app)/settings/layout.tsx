'use client';

import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

import { useViewer } from '@/app/providers/viewer-provider';

/** School Settings behaves like every other primary navigation section: its
 * section list lives in the shell's secondary panel (and curved mobile
 * flyout), so the page content does not repeat that navigation. */
export default function SettingsSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { schools, activeSchoolId } = useViewer();
  const activeSchool = schools.find((school) => school.id === activeSchoolId);

  return (
    <ShellMain>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="School settings"
          meta={[
            {
              key: 'tenant',
              label: activeSchool?.name ?? 'Active school',
              emphasis: true,
            },
          ]}
        />
        {children}
      </div>
    </ShellMain>
  );
}
