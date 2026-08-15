import { Prisma } from '@workspace/database';

import { prisma } from '../../src/singleton.js';
import {
  STANDARD_INTAKE_SECTIONS,
  definitionHasSystemIntake,
  type FormDefinitionSeed,
} from './admission-standard-intake.js';

/**
 * Backfill: give existing tenants' published application forms the standard
 * SYSTEM sections, so their intake surfaces (staff New Application + public apply)
 * become definition-driven — matching what new tenants get from the seed.
 *
 * The WB3 authoring consolidation (#117/#120/#121) makes the standard applicant /
 * applying-for / guardians fields editable "system" sections of the published
 * form. New tenants are seeded with them; tenants whose form predates the change
 * still render the bespoke fallback. This prepends the standard sections to each
 * such form (preserving the school's own custom sections) as a new PUBLISHED
 * version, archiving the prior one — exactly the shape a publish produces.
 *
 * Idempotent: a form that already carries system sections is skipped, so it is
 * safe to run more than once. Covers every owner (tenant-default AND per-campus).
 *
 * Usage (never against production without a current backup):
 *   DATABASE_URL="$URL" pnpm --filter @workspace/database db:backfill:admission-system-sections
 *   …add --dry-run to report what WOULD change without writing.
 */

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host || '(unknown)';
    } catch {
      return '(unknown)';
    }
  })();
  console.log(
    `\nAdmission system-section backfill${DRY_RUN ? ' [DRY RUN]' : ''} → ${host}\n`,
  );

  const forms = await prisma.form.findMany({
    where: { purpose: 'admissions.application' },
    select: {
      id: true,
      tenantId: true,
      ownerType: true,
      ownerId: true,
      createdBy: true,
    },
  });

  let scanned = 0;
  let backfilled = 0;
  let skippedAlready = 0;
  let skippedNoPublished = 0;

  for (const form of forms) {
    scanned++;

    const published = await prisma.formVersion.findFirst({
      where: { tenantId: form.tenantId, formId: form.id, status: 'published' },
      orderBy: { version: 'desc' },
    });
    if (!published) {
      skippedNoPublished++;
      continue;
    }
    if (definitionHasSystemIntake(published.definition)) {
      skippedAlready++;
      continue;
    }

    const def = published.definition as unknown as FormDefinitionSeed;
    const existing = Array.isArray(def.sections) ? def.sections : [];
    const newDefinition = {
      ...def,
      sections: [...STANDARD_INTAKE_SECTIONS, ...existing],
    };

    // Version numbers are unique per form; take the next above ANY version
    // (a lingering draft may sit above the published one).
    const latest = await prisma.formVersion.findFirst({
      where: { tenantId: form.tenantId, formId: form.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const label = `${form.ownerType}:${form.ownerId} (tenant ${form.tenantId})`;
    if (DRY_RUN) {
      console.log(
        `  [dry-run] ${label} — would publish v${nextVersion} (system sections + ${existing.length} existing)`,
      );
      backfilled++;
      continue;
    }

    await prisma.$transaction([
      prisma.formVersion.updateMany({
        where: {
          tenantId: form.tenantId,
          formId: form.id,
          status: 'published',
        },
        data: { status: 'archived', updatedBy: form.createdBy ?? undefined },
      }),
      prisma.formVersion.create({
        data: {
          tenantId: form.tenantId,
          formId: form.id,
          version: nextVersion,
          status: 'published',
          definition: newDefinition as unknown as Prisma.InputJsonValue,
          publishedAt: new Date(),
          publishedBy: form.createdBy ?? undefined,
          createdBy: form.createdBy ?? undefined,
          updatedBy: form.createdBy ?? undefined,
        },
      }),
    ]);
    backfilled++;
    console.log(`  ✔ ${label} — published v${nextVersion}`);
  }

  console.log(
    `\n${DRY_RUN ? '[DRY RUN] ' : ''}Done: scanned ${scanned}, ` +
      `${DRY_RUN ? 'would backfill' : 'backfilled'} ${backfilled}, ` +
      `skipped ${skippedAlready} (already have system sections) + ` +
      `${skippedNoPublished} (no published version).\n`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
