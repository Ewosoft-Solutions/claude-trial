'use client';

import Link from 'next/link';
import * as React from 'react';
import {
  CalendarPlus,
  GraduationCap,
  RefreshCw,
  RotateCw,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { ModeToggle } from '@workspace/ui/custom/mode-toggle';
import {
  EmptyState,
  ErrorState,
  ForbiddenState,
} from '@workspace/ui/custom/states/page-states';
import {
  LoadingState,
  Spinner,
} from '@workspace/ui/custom/states/loading-state';
import {
  SkeletonCardGrid,
  SkeletonForm,
  SkeletonList,
  SkeletonTable,
  SkeletonText,
} from '@workspace/ui/custom/states/skeletons';
import {
  NoticeBanner,
  OfflineBanner,
  ReadOnlyBanner,
} from '@workspace/ui/custom/states/notice-banner';
import { ValidationSummary } from '@workspace/ui/custom/states/validation-summary';
import type { ValidationItem } from '@workspace/ui/types/states.types';

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A bordered surface used to frame a full-surface state for the preview. */
function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card">
      {children}
    </div>
  );
}

function ValidationDemo() {
  const [items, setItems] = React.useState<ValidationItem[]>([]);
  const [autoFocus, setAutoFocus] = React.useState(false);

  const validate = () => {
    const name = (
      document.getElementById('vs-name') as HTMLInputElement | null
    )?.value.trim();
    const email = (
      document.getElementById('vs-email') as HTMLInputElement | null
    )?.value.trim();

    const next: ValidationItem[] = [];
    if (!name) {
      next.push({
        key: 'name',
        fieldId: 'vs-name',
        message: 'Student name is required.',
      });
    }
    if (!email || !email.includes('@')) {
      next.push({
        key: 'email',
        fieldId: 'vs-email',
        message: 'Enter a valid guardian email address.',
      });
    }
    setAutoFocus(true);
    setItems(next);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        validate();
      }}
      className="max-w-md space-y-4"
    >
      <ValidationSummary
        title="Please fix the following before saving"
        items={items}
        autoFocus={autoFocus}
      />
      <div className="grid gap-2">
        <Label htmlFor="vs-name">Student name</Label>
        <Input id="vs-name" placeholder="e.g. Maya Okafor" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="vs-email">Guardian email</Label>
        <Input id="vs-email" type="email" placeholder="guardian@example.com" />
      </div>
      <Button type="submit">Save student</Button>
    </form>
  );
}

export default function StatesPage() {
  const [showOffline, setShowOffline] = React.useState(true);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            State &amp; Feedback Components
          </h1>
          <p className="text-sm text-muted-foreground">
            Reusable states so screens never appear blank or undefined. All copy
            is consumer-supplied; tones map to the shared status tokens.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/design-system">← Design system</Link>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <div className="space-y-12">
        <Section
          title="Loading"
          description="Indeterminate waits. role=status announces the busy region."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Surface>
              <LoadingState label="Loading dashboard…" />
            </Surface>
            <Surface>
              <LoadingState compact label="Saving…" />
            </Surface>
            <Surface>
              <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
                <Spinner size={16} />
                Inline spinner
              </div>
            </Surface>
          </div>
        </Section>

        <Section
          title="Skeletons"
          description="Content-shaped placeholders that prevent layout shift on load."
        >
          <div className="space-y-6">
            <SkeletonCardGrid count={4} />
            <div className="grid gap-6 lg:grid-cols-2">
              <Surface>
                <div className="p-5">
                  <SkeletonList rows={4} />
                </div>
              </Surface>
              <Surface>
                <div className="p-5">
                  <SkeletonForm fields={3} />
                </div>
              </Surface>
            </div>
            <SkeletonTable rows={5} columns={4} />
            <Surface>
              <div className="p-5">
                <SkeletonText lines={3} />
              </div>
            </Surface>
          </div>
        </Section>

        <Section
          title="Empty"
          description="Loaded successfully, but nothing to show yet."
        >
          <Surface>
            <EmptyState
              title="No students enrolled yet"
              description="Add your first student or import a class list to get started."
              primaryAction={{
                label: 'Add student',
                onClick: () => undefined,
              }}
              secondaryAction={{
                label: 'Import CSV',
                onClick: () => undefined,
              }}
            />
          </Surface>
        </Section>

        <Section
          title="Error"
          description="Something failed to load. role=alert; pair with a retry."
        >
          <Surface>
            <ErrorState
              title="Couldn’t load attendance"
              description="There was a problem reaching the server. Check your connection and try again."
              primaryAction={{
                label: 'Retry',
                icon: <RotateCw aria-hidden />,
                onClick: () => undefined,
              }}
            />
          </Surface>
        </Section>

        <Section
          title="Forbidden"
          description="Deep-link / direct access to a route the viewer can’t see. Pairs with the M4 nav access model (which hides the nav entry)."
        >
          <Surface>
            <ForbiddenState
              title="You don’t have access to Finance"
              description="This area is limited to roles with finance clearance. Contact a school administrator if you think this is a mistake."
              icon={<GraduationCap aria-hidden />}
              primaryAction={{
                label: 'Back to dashboard',
                href: '/design-system',
              }}
            />
          </Surface>
        </Section>

        <Section
          title="Offline / read-only banners"
          description="Non-blocking strips above a surface; content still renders beneath."
        >
          <div className="space-y-3">
            {showOffline ? (
              <OfflineBanner
                title="You’re offline"
                description="Showing the last loaded data. Changes will sync when you reconnect."
                action={{
                  label: 'Retry',
                  icon: <RefreshCw aria-hidden />,
                  onClick: () => undefined,
                }}
                onDismiss={() => setShowOffline(false)}
              />
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOffline(true)}
              >
                Show offline banner again
              </Button>
            )}
            <ReadOnlyBanner
              title="Read-only"
              description="The term is locked. You can view records but not edit them."
            />
            <NoticeBanner
              tone="info"
              title="New term starts Monday"
              description="Timetables for Term 3 are now available to preview."
              icon={<CalendarPlus aria-hidden />}
              action={{ label: 'Preview', onClick: () => undefined }}
            />
          </div>
        </Section>

        <Section
          title="Validation summary"
          description="Grouped form errors. role=alert, focusable, links focus the offending field. Submit empty to trigger."
        >
          <Surface>
            <div className="p-6">
              <ValidationDemo />
            </div>
          </Surface>
        </Section>
      </div>
    </main>
  );
}
