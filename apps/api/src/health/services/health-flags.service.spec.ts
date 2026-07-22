/**
 * HealthFlagsService — the searchable layer over encrypted health data.
 *
 * The properties under test are the ones the design depends on: the index is
 * deterministic (so search works), opaque (so a dump is useless), and closed
 * (so a typo cannot create a silently unfindable pupil).
 */
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { HealthFlagsService } from './health-flags.service';

function build() {
  const config = {
    getOrThrow: () => ({
      NODE_ENV: 'test',
      ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
    }),
  } as unknown as ConfigService;
  const encryption = new EncryptionService(config);
  return { service: new HealthFlagsService(encryption), encryption };
}

describe('HealthFlagsService', () => {
  it('round-trips flags through the encrypted display copy', () => {
    const { service } = build();
    const codes = ['allergy:peanut', 'condition:asthma'];

    const encoded = service.encode(codes);

    expect(service.decode(encoded.healthFlagsEnc)).toEqual(codes);
  });

  it('produces a deterministic index so the same flag is findable', () => {
    const { service } = build();

    // Two separate encodes must yield the same digest, or search breaks.
    const a = service.encode(['allergy:peanut']);
    const b = service.encode(['allergy:peanut']);

    expect(a.healthFlagIndex).toEqual(b.healthFlagIndex);
  });

  it('keeps the plaintext code out of both stored columns', () => {
    const { service } = build();

    const encoded = service.encode(['allergy:peanut']);

    // A dump of either column must not reveal the flag.
    expect(encoded.healthFlagIndex.join()).not.toContain('peanut');
    expect(encoded.healthFlagsEnc).not.toContain('peanut');
  });

  it('encrypts the display copy non-deterministically', () => {
    const { service } = build();

    const a = service.encode(['allergy:peanut']);
    const b = service.encode(['allergy:peanut']);

    // Same flag, different ciphertext (random IV) — while the index above stays
    // stable. That split is the whole design.
    expect(a.healthFlagsEnc).not.toEqual(b.healthFlagsEnc);
  });

  it('matches regardless of casing or whitespace', () => {
    const { service } = build();

    const stored = service.encode(['allergy:peanut']);
    const queried = service.indexFor('  Allergy:PEANUT  ');

    expect(stored.healthFlagIndex).toContain(queried);
  });

  it('rejects codes outside the vocabulary rather than indexing them', () => {
    const { service } = build();

    // A free-text code would hash to a digest nothing else produces, making the
    // pupil silently unfindable — the exact failure the vocabulary prevents.
    expect(() => service.encode(['allergy:peanuts'])).toThrow(
      BadRequestException,
    );
    expect(() => service.encode(['nonsense'])).toThrow(BadRequestException);
  });

  it('de-duplicates repeated codes', () => {
    const { service } = build();

    const encoded = service.encode([
      'allergy:peanut',
      'allergy:peanut',
      'condition:asthma',
    ]);

    expect(encoded.healthFlagIndex).toHaveLength(2);
  });

  it('clears both columns for an empty flag list', () => {
    const { service } = build();

    expect(service.encode([])).toEqual({
      healthFlagsEnc: null,
      healthFlagIndex: [],
    });
  });

  it('separates domains so an identical value indexes differently elsewhere', () => {
    const { service, encryption } = build();

    const asFlag = service.indexFor('allergy:peanut');
    const asOther = encryption.blindIndex('allergy:peanut', 'some-other-domain');

    expect(asFlag).not.toEqual(asOther);
  });

  it('degrades to no flags rather than throwing on an unreadable blob', () => {
    const { service } = build();

    // Wrong key or partial restore: the rest of the pupil's profile should
    // still render.
    expect(service.decode('not-valid-ciphertext')).toEqual([]);
    expect(service.decode(null)).toEqual([]);
  });

  it('builds any/all filters over digests, not plaintext', () => {
    const { service } = build();

    const any = service.hasAnyFilter(['allergy:peanut']);
    const all = service.hasAllFilter(['allergy:peanut', 'condition:asthma']);

    expect(any.hasSome).toEqual([service.indexFor('allergy:peanut')]);
    expect(all.hasEvery).toHaveLength(2);
    expect(JSON.stringify(all)).not.toContain('peanut');
  });
});
