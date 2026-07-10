/* ============================================================
   /login — server shell that resolves the subdomain tenant

   When reached at `{slug}.domain`, the middleware forwards the slug
   as the x-tenant-slug header; here we resolve it to public school
   branding (GET /public/tenants/:slug) and brand the sign-in form.
   Falls back to a plain, un-branded form on the apex domain.
   ============================================================ */

import { headers } from 'next/headers';
import { apiClient, ApiError } from '@/lib/api-client';
import { TENANT_SLUG_HEADER } from '@/lib/tenant-host';
import { LoginForm } from './login-form';

interface PublicTenant {
  id: string;
  name: string;
  slug: string;
  schoolType: string | null;
  status: string;
}

async function resolveSchoolName(): Promise<string | undefined> {
  const slug = (await headers()).get(TENANT_SLUG_HEADER);
  if (!slug) return undefined;
  try {
    const tenant = await apiClient.get<PublicTenant>(
      `/public/tenants/${encodeURIComponent(slug)}`,
    );
    return tenant.name;
  } catch (err) {
    // Unknown/suspended subdomain → fall back to the generic form.
    if (err instanceof ApiError && err.status === 404) return undefined;
    return undefined;
  }
}

export default async function LoginPage() {
  const schoolName = await resolveSchoolName();
  return <LoginForm schoolName={schoolName} />;
}
