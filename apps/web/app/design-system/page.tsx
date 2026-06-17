'use client';

import { Button } from '@workspace/ui/components/button';
import { Badge } from '@workspace/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { ModeToggle } from '@workspace/ui/custom/mode-toggle';

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

export default function DesignSystemPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            SchoolWithEase Design System
          </h1>
          <p className="text-sm text-muted-foreground">
            Preview surface for shared <code>@workspace/ui</code> components.
            Toggle the theme to verify light and dark parity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <a href="/design-system/states">View states →</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/design-system/layouts">View layouts →</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/design-system/shell">View app shell →</a>
          </Button>
          <ModeToggle />
        </div>
      </header>

      <div className="space-y-12">
        <Section
          title="Preview surfaces"
          description="Live previews of the shared component set. See packages/ui/README.md for usage, the accessibility checklist, and known gaps."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                href: '/design-system/shell',
                title: 'Application shell',
                body: 'Header, rail, navigation, school switcher, user menu — driven by the role-aware navigation model (persona switcher).',
              },
              {
                href: '/design-system/states',
                title: 'States & feedback',
                body: 'Loading, skeletons, empty, error, forbidden, offline/read-only banners, and the validation summary.',
              },
              {
                href: '/design-system/layouts',
                title: 'Layout patterns',
                body: 'Dashboard, list/detail, data table, form, and settings — composed from primitives and the states above.',
              },
            ].map((s) => (
              <Card key={s.href} className="gap-0 py-5">
                <CardHeader className="px-5">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <CardDescription>{s.body}</CardDescription>
                </CardHeader>
                <CardFooter className="px-5 pt-4">
                  <Button asChild variant="outline" size="sm">
                    <a href={s.href}>Open preview →</a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </Section>

        <Section
          title="Buttons"
          description="Variants and sizes from the shared button component."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section
          title="Badges"
          description="Status and label tokens."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </Section>

        <Section
          title="Form controls"
          description="Inputs and labels for data entry surfaces."
        >
          <div className="grid max-w-sm gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="teacher@school.edu" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="disabled">Disabled</Label>
              <Input id="disabled" placeholder="Read only" disabled />
            </div>
          </div>
        </Section>

        <Section
          title="Cards"
          description="Composable container surface used across dashboards."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Enrollment</CardTitle>
                <CardDescription>Active students this term</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">1,248</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">
                  View details
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Outstanding fees</CardTitle>
                <CardDescription>Across all classes</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">$42,300</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm">
                  Review
                </Button>
              </CardFooter>
            </Card>
          </div>
        </Section>
      </div>
    </main>
  );
}
