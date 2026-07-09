import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';

interface TenantConfiguration {
  name?: string | null;
  emailDomain?: string | null;
  settings?: Record<string, unknown> | null;
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export default async function GeneralSettingsPage() {
  const session = await getSession();
  const tenantId = session?.defaultSchoolId;
  const configuration = tenantId
    ? await serverApiGet<TenantConfiguration>(`/tenant/${tenantId}/configuration`)
    : null;
  const settings = record(configuration?.settings);
  const general = record(settings.general);
  const locale = record(settings.locale);
  const schoolName = configuration?.name ?? session?.schools[0]?.name ?? '';

  return (
    <div className="flex flex-col gap-5">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">School profile</CardTitle>
          <CardDescription>
            Values loaded from the tenant configuration API.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="school-name" label="School name">
            <Input id="school-name" defaultValue={schoolName} />
          </Field>
          <Field id="short-name" label="Short name">
            <Input id="short-name" defaultValue={text(general.shortName)} />
          </Field>
          <Field id="contact-email" label="Contact email">
            <Input id="contact-email" type="email" defaultValue={text(general.contactEmail)} />
          </Field>
          <Field id="phone" label="Phone">
            <Input id="phone" type="tel" defaultValue={text(general.phone)} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="address" label="Address">
              <Input id="address" defaultValue={text(general.address)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Academic & locale</CardTitle>
          <CardDescription>
            Stored defaults for terms, scheduling and formatting.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field id="academic-year" label="Academic year">
            <Input id="academic-year" defaultValue={text(locale.academicYear)} />
          </Field>
          <Field id="current-term" label="Current term">
            <Input id="current-term" defaultValue={text(locale.currentTerm)} />
          </Field>
          <Field id="timezone" label="Timezone">
            <Input id="timezone" defaultValue={text(locale.timezone)} />
          </Field>
          <Field id="currency" label="Currency">
            <Input id="currency" defaultValue={text(locale.currency)} />
          </Field>
          <div className="sm:col-span-2">
            <Field id="email-domain" label="Email domain">
              <Input id="email-domain" defaultValue={configuration?.emailDomain ?? ''} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2.5">
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button size="sm">Save changes</Button>
      </div>
    </div>
  );
}
