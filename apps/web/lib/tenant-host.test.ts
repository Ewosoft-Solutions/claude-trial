import { describe, expect, it } from 'vitest';
import { extractTenantSlug } from './tenant-host';

describe('extractTenantSlug', () => {
  const ROOT = 'schoolwithease.com';

  it('extracts the slug from a subdomain of the root', () => {
    expect(extractTenantSlug('st-jude.schoolwithease.com', ROOT)).toBe('st-jude');
    expect(extractTenantSlug('ST-JUDE.SchoolWithEase.com', ROOT)).toBe('st-jude');
  });

  it('extracts from a *.localhost dev host with a port', () => {
    expect(extractTenantSlug('st-jude.localhost:3030')).toBe('st-jude');
  });

  it('returns null on the apex domain', () => {
    expect(extractTenantSlug('schoolwithease.com', ROOT)).toBeNull();
    expect(extractTenantSlug('localhost:3030')).toBeNull();
  });

  it('ignores reserved subdomains', () => {
    expect(extractTenantSlug('www.schoolwithease.com', ROOT)).toBeNull();
    expect(extractTenantSlug('api.schoolwithease.com', ROOT)).toBeNull();
    expect(extractTenantSlug('app.localhost')).toBeNull();
  });

  it('returns null for a host not under the configured root', () => {
    expect(extractTenantSlug('st-jude.evil.com', ROOT)).toBeNull();
  });

  it('returns null for raw IPs and empty hosts', () => {
    expect(extractTenantSlug('127.0.0.1:3030', ROOT)).toBeNull();
    expect(extractTenantSlug('', ROOT)).toBeNull();
    expect(extractTenantSlug(null, ROOT)).toBeNull();
  });

  it('rejects invalid slug characters', () => {
    expect(extractTenantSlug('bad_slug.schoolwithease.com', ROOT)).toBeNull();
    expect(extractTenantSlug('-lead.schoolwithease.com', ROOT)).toBeNull();
  });

  it('uses only the left-most label when nested', () => {
    expect(extractTenantSlug('st-jude.region.schoolwithease.com', ROOT)).toBe('st-jude');
  });
});
