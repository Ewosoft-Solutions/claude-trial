/**
 * TenantService.getPublicBySlug — the unauthenticated subdomain lookup. Only
 * active tenants resolve, and only non-sensitive fields are selected.
 */
import { NotFoundException } from '@nestjs/common';
import { TenantService } from './tenant.service';

function build(tenant: unknown) {
  const findUnique = jest.fn().mockResolvedValue(tenant);
  const db = { client: { tenant: { findUnique } } };
  return { service: new TenantService(db as never), findUnique };
}

describe('TenantService.getPublicBySlug', () => {
  it('returns branding for an active tenant', async () => {
    const { service, findUnique } = build({
      id: 't1',
      name: 'St. Jude Academy',
      slug: 'st-jude',
      schoolType: 'secondary',
      status: 'active',
    });
    const result = await service.getPublicBySlug('st-jude');
    expect(result).toMatchObject({ id: 't1', name: 'St. Jude Academy' });
    // Only branding fields are selected — never secrets/settings.
    expect(findUnique).toHaveBeenCalledWith({
      where: { slug: 'st-jude' },
      select: { id: true, name: true, slug: true, schoolType: true, status: true },
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
