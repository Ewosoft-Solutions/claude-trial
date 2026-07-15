import { getSession } from '@/lib/session';
import { serverApiGet } from '@/lib/server-api';
import { GeneralSettingsForm } from './general-settings-form';

interface TenantConfiguration {
  name?: string | null;
  emailDomain?: string | null;
  settings?: Record<string, unknown> | null;
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
  const configuration = session
    ? await serverApiGet<TenantConfiguration>('/tenant/configuration')
    : null;
  const settings = record(configuration?.settings);
  const general = record(settings.general);
  const locale = record(settings.locale);

  return (
    <GeneralSettingsForm
      canEdit={session?.permissions.includes('settings.school') ?? false}
      initial={{
        schoolName: configuration?.name ?? session?.schools[0]?.name ?? '',
        shortName: text(general.shortName),
        contactEmail: text(general.contactEmail),
        phone: text(general.phone),
        address: text(general.address),
        academicYear: text(locale.academicYear),
        currentTerm: text(locale.currentTerm),
        timezone: text(locale.timezone),
        currency: text(locale.currency),
        emailDomain: configuration?.emailDomain ?? '',
      }}
    />
  );
}
