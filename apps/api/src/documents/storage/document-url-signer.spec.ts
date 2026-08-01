import { describe, it, expect } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { DocumentUrlSigner } from './document-url-signer';

function makeSigner(secret = 'unit-test-secret'): DocumentUrlSigner {
  const config = {
    getOrThrow: () => ({ DOCUMENT_URL_SIGNING_SECRET: secret }),
  } as unknown as ConfigService;
  return new DocumentUrlSigner(config);
}

describe('DocumentUrlSigner (F4)', () => {
  const claims = { tenantId: 't1', documentId: 'd1', versionId: 'v1' };

  it('round-trips a valid token', () => {
    const signer = makeSigner();
    const { token } = signer.sign(claims);
    const verified = signer.verify(token);
    expect(verified).toMatchObject(claims);
  });

  it('rejects a tampered payload', () => {
    const signer = makeSigner();
    const { token } = signer.sign(claims);
    const [payload, mac] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ ...claims, documentId: 'other', exp: 9999999999 }),
    ).toString('base64url');
    expect(signer.verify(`${forged}.${mac}`)).toBeNull();
    // and a wrong mac
    expect(signer.verify(`${payload}.deadbeef`)).toBeNull();
  });

  it('rejects an expired token', () => {
    const signer = makeSigner();
    const { token } = signer.sign(claims, -1); // already expired
    expect(signer.verify(token)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const { token } = makeSigner('secret-a').sign(claims);
    expect(makeSigner('secret-b').verify(token)).toBeNull();
  });
});
