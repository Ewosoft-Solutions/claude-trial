'use client';

/**
 * WB3 consolidation · the single "Application form" authoring surface. One page,
 * two tabs — **Form fields** (the versioned form builder: standard system
 * sections shown editable-but-bound + the school's own questions) and
 * **Documents & fees** (the requirements checklist). A campus selector on the
 * Form fields tab authors a per-campus variant (falling back to the school-wide
 * default); it drives a `?campus=` query so the server re-resolves that campus's
 * versions. Both editors render `embedded` (this shell owns the page chrome).
 */
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2, Check } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  FolderTabs as Tabs,
  FolderTabsContent as TabsContent,
  FolderTabsList as TabsList,
  FolderTabsTrigger as TabsTrigger,
} from '@workspace/ui/custom/detail/folder-tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { PageTitle } from '@workspace/ui/custom/shell/page-title';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';

import { FormsBuilder } from '../forms/forms-builder';
import { RequirementsEditor } from '../requirements/requirements-editor';
import type { RequirementTemplateRow } from '../requirements/requirements-editor';
import type { FormVersion } from '../admissions-types';

const DEFAULT = '__default__';

export function ApplicationFormShell({
  versions,
  campuses,
  campusOverrides,
  selectedCampus,
  canManage,
  requirements,
  yearLevels,
  sections,
  initialTab = 'fields',
}: {
  versions: FormVersion[];
  campuses: { id: string; name: string; code: string }[];
  campusOverrides: string[];
  /** '' = the school-wide default; else a campus id. */
  selectedCampus: string;
  canManage: boolean;
  requirements: RequirementTemplateRow[];
  yearLevels: { id: string; name: string }[];
  sections: { id: string; displayLabel: string }[];
  /** Which tab opens first (deep-linkable via `?tab=`). */
  initialTab?: 'fields' | 'requirements';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const selectCampus = (next: string) => {
    const params = new URLSearchParams(search.toString());
    if (next && next !== DEFAULT) params.set('campus', next);
    else params.delete('campus');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const campusName =
    selectedCampus && campuses.find((c) => c.id === selectedCampus)?.name;
  const usingDefault =
    !!selectedCampus && !campusOverrides.includes(selectedCampus);

  return (
    <ShellMain className="gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/students/admissions">
            <ArrowLeft className="mr-1 size-4" aria-hidden /> Admissions
          </Link>
        </Button>
        <PageTitle>Application form</PageTitle>
        <p className="max-w-3xl text-sm text-muted-foreground">
          One place to author what applicants fill in — the standard fields,
          your own questions, and the documents &amp; fees you collect. Refine
          the form per campus or keep a single school-wide version.
        </p>
      </div>

      <Tabs defaultValue={initialTab} className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Full width so the strip's rule spans the page rather than
              stopping under the last tab — as a flex child it would
              otherwise shrink to its content. */}
          <TabsList className="w-full">
            <TabsTrigger value="fields">Form fields</TabsTrigger>
            <TabsTrigger value="requirements">Documents &amp; fees</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="fields"
          className="mt-0 flex flex-col gap-6 focus-visible:outline-none"
        >
          {campuses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-sm text-muted-foreground">Editing</span>
              <Select
                value={selectedCampus || DEFAULT}
                onValueChange={selectCampus}
              >
                <SelectTrigger className="w-64" aria-label="Form variant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT}>
                    Default (all campuses)
                  </SelectItem>
                  {campuses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.name}
                        {campusOverrides.includes(c.id) && (
                          <Check
                            className="size-3.5 text-muted-foreground"
                            aria-label="has its own form"
                          />
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {usingDefault && (
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{campusName}</span>{' '}
              currently uses the school-wide default form.
              {canManage
                ? ' Create a version below to give this campus its own.'
                : ''}
            </div>
          )}

          <FormsBuilder
            key={selectedCampus || DEFAULT}
            versions={versions}
            canManage={canManage}
            campusId={selectedCampus || undefined}
            embedded
          />
        </TabsContent>

        <TabsContent
          value="requirements"
          className="mt-0 focus-visible:outline-none"
        >
          <RequirementsEditor
            requirements={requirements}
            yearLevels={yearLevels}
            sections={sections}
            canManage={canManage}
            embedded
          />
        </TabsContent>
      </Tabs>
    </ShellMain>
  );
}
