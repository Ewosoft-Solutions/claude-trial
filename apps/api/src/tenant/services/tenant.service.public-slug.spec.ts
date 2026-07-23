/**
 * TenantService.getPublicBySlug — the unauthenticated subdomain lookup. Only
 * active tenants resolve, and only non-sensitive fields are selected.
 */
import { NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';

function build(tenant: unknown) {
  const findUnique = jest.fn().mockResolvedValue(tenant);
  // Stands in for TenantDbService: `runPlatform` opens the audited cross-tenant
  // scope, and `client` is only valid inside it — so the fake runs the callback
  // inline and exposes the same client.
  const runPlatform = jest.fn((_userId: unknown, fn: () => unknown) => fn());
  const db = { runPlatform, client: { tenant: { findUnique } } };
  return { service: new TenantService(db as never), findUnique, runPlatform };
}

describe('TenantService.getPublicBySlug', () => {
  it('returns branding for an active tenant', async () => {
    const { service, findUnique, runPlatform } = build({
      id: 't1',
      name: 'St. Jude Academy',
      slug: 'st-jude',
      schoolType: 'secondary',
      status: 'active',
    });
    const result = await service.getPublicBySlug('st-jude');
    expect(result).toMatchObject({ id: 't1', name: 'St. Jude Academy' });
    // The lookup crosses tenants, so it must run in the platform scope rather
    // than on the privileged client.
    expect(runPlatform).toHaveBeenCalledTimes(1);
    // Only branding fields are selected — never secrets/settings.
    expect(findUnique).toHaveBeenCalledWith({
      where: { slug: 'st-jude' },
      select: {
        id: true,
        name: true,
        slug: true,
        schoolType: true,
        status: true,
      },
    });
  });

  it('404s for an unknown slug', async () => {
    const { service } = build(null);
    await expect(service.getPublicBySlug('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404s for a suspended tenant', async () => {
    const { service } = build({
      id: 't1',
      name: 'Suspended',
      slug: 's',
      schoolType: null,
      status: 'suspended',
    });
    await expect(service.getPublicBySlug('s')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
