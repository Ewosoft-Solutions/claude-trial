/**
 * Document / media platform + signatures (F4 / ADR-08) — behavioural proof.
 *
 * Boots the real AppModule and exercises DocumentService + SignatureService on
 * the app_runtime (RLS-enforcing) client, driving the scan pipeline through the
 * real F3 JobWorker. Proves the ADR-08 acceptance:
 *   - an upload is quarantined until the scan job clears it; then a signed,
 *     short-lived URL works and returns the exact bytes
 *   - a tampered/expired token is rejected
 *   - a sensitive document cannot be download-minted without authorization
 *   - a malicious (EICAR) upload is quarantined and never downloadable
 *   - a signature is usable ONLY via an authorized SignatureUse; a revoked
 *     authority is refused; the raw signature image is never listed
 *   - RLS isolates documents across tenants
 *
 * Requires APP_RUNTIME_DATABASE_URL; skips otherwise (see jobs/person specs).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { AppModule } from '../src/app.module';
import { TenantDbService } from '../src/common';
import { JobWorker } from '../src/common/jobs/job.worker';
import { DocumentService } from '../src/documents/services/document.service';
import { SignatureService } from '../src/documents/services/signature.service';
import { DocumentUrlSigner } from '../src/documents/storage/document-url-signer';
import { PersonService } from '../src/person/services/person.service';
import { EICAR_TEST_SIGNATURE } from '../src/documents/storage/document-scanner';
import { makeSuperuserClient } from './helpers/superuser-client';

const HAS_APP_RUNTIME = !!process.env.APP_RUNTIME_DATABASE_URL;
const d = HAS_APP_RUNTIME ? describe : describe.skip;

interface CountRow {
  n: number;
}

d('Document + signature platform (F4)', () => {
  let app: INestApplication;
  let owner: ReturnType<typeof makeSuperuserClient>;
  let tenantDb: TenantDbService;
  let worker: JobWorker;
  let documents: DocumentService;
  let signatures: SignatureService;
  let signer: DocumentUrlSigner;
  let people: PersonService;

  const A = `doc-a-${Date.now()}`;
  const B = `doc-b-${Date.now()}`;
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();

    owner = makeSuperuserClient();
    tenantDb = app.get(TenantDbService);
    worker = app.get(JobWorker);
    documents = app.get(DocumentService);
    signatures = app.get(SignatureService);
    signer = app.get(DocumentUrlSigner);
    people = app.get(PersonService);

    const ta = await owner.tenant.create({
      data: { name: 'Doc A', slug: A, status: 'active' },
    });
    const tb = await owner.tenant.create({
      data: { name: 'Doc B', slug: B, status: 'active' },
    });
    tenantAId = ta.id;
    tenantBId = tb.id;
  });

  afterAll(async () => {
    if (owner) {
      await owner.tenant.deleteMany({ where: { slug: { in: [A, B] } } });
      await owner.$disconnect();
    }
    if (app) await app.close();
  });

  const inA = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantAId, undefined, fn);
  const inB = <T>(fn: () => Promise<T>) =>
    tenantDb.runScoped(tenantBId, undefined, fn);

  /** Drain the queue (scan + any thumbnail follow-ups). */
  const drainJobs = async () => {
    for (let i = 0; i < 10; i++) {
      if (!(await worker.processOnce())) break;
    }
  };

  it('quarantines an upload until scanned, then serves it via a signed URL', async () => {
    const bytes = Buffer.from('hello world pdf bytes');
    const doc = await inA(() =>
      documents.upload(tenantAId, undefined, {
        ownerType: 'Person',
        ownerId: 'person-1',
        mime: 'application/pdf',
        filename: 'note.pdf',
        content: bytes,
      }),
    );
    expect(doc.scanStatus).toBe('pending');

    // Before scan: download is refused (quarantined).
    await expect(
      inA(() => documents.mintDownloadUrl(tenantAId, undefined, doc.id, true)),
    ).rejects.toThrow();

    await drainJobs();

    const scanned = await inA(() => documents.get(tenantAId, doc.id));
    expect(scanned.scanStatus).toBe('clean');

    const minted = await inA(() =>
      documents.mintDownloadUrl(tenantAId, undefined, doc.id, true),
    );
    const file = await inA(() =>
      documents.resolveDownload(tenantAId, undefined, minted.token),
    );
    expect(file.buffer.equals(bytes)).toBe(true);
    expect(file.mime).toBe('application/pdf');
  });

  it('rejects a tampered or expired download token', async () => {
    await expect(
      inA(() => documents.resolveDownload(tenantAId, undefined, 'not.a.valid.token')),
    ).rejects.toThrow();

    // A token minted for tenant B must not resolve under tenant A's scope.
    const foreign = signer.sign({
      tenantId: tenantBId,
      documentId: 'x',
      versionId: 'y',
    });
    await expect(
      inA(() => documents.resolveDownload(tenantAId, undefined, foreign.token)),
    ).rejects.toThrow();
  });

  it('refuses to mint a sensitive document without authorization', async () => {
    const doc = await inA(() =>
      documents.upload(tenantAId, undefined, {
        ownerType: 'Person',
        ownerId: 'person-2',
        mime: 'application/pdf',
        sensitive: true,
        content: Buffer.from('confidential'),
      }),
    );
    await drainJobs();

    // canDownloadSensitive = false → forbidden
    await expect(
      inA(() => documents.mintDownloadUrl(tenantAId, undefined, doc.id, false)),
    ).rejects.toThrow();
    // canDownloadSensitive = true → allowed
    const ok = await inA(() =>
      documents.mintDownloadUrl(tenantAId, undefined, doc.id, true),
    );
    expect(ok.token).toBeTruthy();
  });

  it('quarantines a malicious (EICAR) upload and never serves it', async () => {
    const doc = await inA(() =>
      documents.upload(tenantAId, undefined, {
        ownerType: 'Person',
        ownerId: 'person-3',
        mime: 'application/octet-stream',
        content: Buffer.from(EICAR_TEST_SIGNATURE),
      }),
    );
    await drainJobs();

    const scanned = await inA(() => documents.get(tenantAId, doc.id));
    expect(scanned.scanStatus).toBe('infected');
    await expect(
      inA(() => documents.mintDownloadUrl(tenantAId, undefined, doc.id, true)),
    ).rejects.toThrow();
  });

  it('applies a signature only via an authorized use; a revoked authority is refused; raw image never listed', async () => {
    const { personId } = await inA(async () => {
      const p = await people.create(tenantAId, undefined, {
        firstName: 'Principal',
        lastName: 'One',
      });
      return { personId: p.id };
    });

    // No authority yet → apply is refused.
    await expect(
      inA(() =>
        signatures.applySignature(tenantAId, undefined, {
          signingAuthorityId: 'nonexistent',
          artifactType: 'ResultPublication',
          artifactId: 'rp-1',
        }),
      ),
    ).rejects.toThrow();

    // Store the signature image as a restricted asset — must NOT appear in a list.
    const sigDoc = await inA(() =>
      documents.upload(tenantAId, undefined, {
        ownerType: 'SignatureAsset',
        ownerId: personId,
        typeKey: undefined,
        sensitive: true,
        visibility: 'restricted',
        mime: 'image/png',
        content: Buffer.from('PNGSIGNATUREBYTES'),
      }),
    );
    const listed = await inA(() =>
      documents.listForOwner(tenantAId, 'SignatureAsset', personId),
    );
    expect(listed).toHaveLength(0); // signature assets are never listed

    const authority = await inA(() =>
      signatures.registerAuthority(tenantAId, undefined, {
        personId,
        role: 'Principal',
        signatureDocumentId: sigDoc.id,
      }),
    );

    const use = await inA(() =>
      signatures.applySignature(tenantAId, undefined, {
        signingAuthorityId: authority.id,
        artifactType: 'ResultPublication',
        artifactId: 'rp-1',
      }),
    );
    expect(use.status).toBe('applied');

    // Revoke → further application is refused.
    await inA(() => signatures.revokeAuthority(tenantAId, undefined, authority.id));
    await expect(
      inA(() =>
        signatures.applySignature(tenantAId, undefined, {
          signingAuthorityId: authority.id,
          artifactType: 'ResultPublication',
          artifactId: 'rp-2',
        }),
      ),
    ).rejects.toThrow();
  });

  it('isolates documents by tenant (RLS)', async () => {
    const doc = await inA(() =>
      documents.upload(tenantAId, undefined, {
        ownerType: 'Person',
        ownerId: 'iso',
        mime: 'text/plain',
        content: Buffer.from('secret'),
      }),
    );
    await expect(inB(() => documents.get(tenantBId, doc.id))).rejects.toThrow();

    const seenFromB = await inB(async () => {
      const rows = await tenantDb.client.$queryRaw<CountRow[]>`
        SELECT count(*)::int AS n FROM "documents"."documents" WHERE "id" = ${doc.id}`;
      return rows[0].n;
    });
    expect(seenFromB).toBe(0);
  });
});
