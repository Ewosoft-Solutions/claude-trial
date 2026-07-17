import { describe, expect, it } from 'vitest';

import { buildLogoutRequest, resolveLogoutReturnPath } from './logout-request';

describe('buildLogoutRequest', () => {
  it('authenticates with the access token and revokes the stored refresh token', () => {
    expect(buildLogoutRequest('access-token', 'refresh-token')).toEqual({
      body: { refreshToken: 'refresh-token' },
      headers: { Authorization: 'Bearer access-token' },
    });
  });

  it('skips the remote call when either token is missing', () => {
    expect(buildLogoutRequest(undefined, 'refresh-token')).toBeNull();
    expect(buildLogoutRequest('access-token', undefined)).toBeNull();
  });

  it('includes an audited inactivity reason when supplied', () => {
    expect(buildLogoutRequest('access', 'refresh', 'idle')?.body).toEqual({
      refreshToken: 'refresh',
      reason: 'idle',
    });
  });
});

describe('resolveLogoutReturnPath', () => {
  it('derives the resume path from a same-origin browser referrer', () => {
    expect(
      resolveLogoutReturnPath(
        'https://school.example/classes/assessments/take/a1?question=4',
        ['https://school.example'],
      ),
    ).toBe('/classes/assessments/take/a1?question=4');
  });

  it('rejects absent, malformed, and cross-origin referrers', () => {
    expect(
      resolveLogoutReturnPath(null, ['https://school.example']),
    ).toBeNull();
    expect(
      resolveLogoutReturnPath('not a url', ['https://school.example']),
    ).toBeNull();
    expect(
      resolveLogoutReturnPath('https://attacker.example/finance', [
        'https://school.example',
      ]),
    ).toBeNull();
  });
});
