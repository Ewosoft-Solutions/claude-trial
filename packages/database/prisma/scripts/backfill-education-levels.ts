import { prisma } from '../../src/singleton.js';
import {
  educationLevelOf,
  isEducationLevel,
  isLevelCode,
  matchLevelCode,
  type EducationLevel,
} from '../../src/education-levels.js';

/**
 * Backfill: map existing free-text academic structure onto the FIXED spine —
 * `year_levels.level_code` and `stages.education_level`.
 *
 * Every school authored its own levels as free text ("Basic 3", "SS1",
 * "Primary 5"), so two schools' equivalent levels were unrelated rows and
 * nothing could line them up. This reads each level's own name + code and
 * resolves it to a national rung via `matchLevelCode`, then derives the stage's
 * band from the rungs beneath it.
 *
 * It never guesses. A level whose name matches nothing is left NULL and printed
 * for a human to map by hand — a wrong code silently mis-files a child's whole
 * academic record, which is far worse than a null.
 *
 * A stage's band is only set when its levels agree unanimously; a stage holding
 * a mix (a "Basic" stage spanning primary and junior secondary, which UBE
 * naming really does produce) is reported as ambiguous and left alone.
 *
 * Idempotent: rows that already carry a value are skipped, so re-running is
 * safe and only picks up what is still unmapped.
 *
 * Usage (never against production without a current backup):
 *   DATABASE_URL="$URL" pnpm --filter @workspace/database db:backfill:education-levels
 *   …add --dry-run to report what WOULD change without writing.
 */

const DRY_RUN = process.argv.includes('--dry-run');

interface Unmapped {
  tenant: string;
  kind: 'year level' | 'stage';
  name: string;
  code: string;
  reason: string;
}

async function main() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host || '(unknown)';
    } catch {
      return '(unknown)';
    }
  })();
  console.log(
    `\nBackfilling the education-level spine on ${host}${DRY_RUN ? ' (DRY RUN — no writes)' : ''}\n`,
  );

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true, schoolType: true },
    orderBy: { name: 'asc' },
  });

  let levelsMapped = 0;
  let levelsSkipped = 0;
  let stagesMapped = 0;
  let stagesSkipped = 0;
  const unmapped: Unmapped[] = [];

  for (const tenant of tenants) {
    const stages = await prisma.stage.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        name: true,
        code: true,
        educationLevel: true,
        yearLevels: {
          select: { id: true, name: true, code: true, levelCode: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    });
    if (stages.length === 0) continue;

    console.log(
      `${tenant.name} (${tenant.slug}) — schoolType=${tenant.schoolType ?? 'unset'}`,
    );

    for (const stage of stages) {
      // ---- year levels: the school's name first, then its short code.
      const resolved: (EducationLevel | null)[] = [];

      for (const level of stage.yearLevels) {
        if (isLevelCode(level.levelCode)) {
          levelsSkipped += 1;
          resolved.push(educationLevelOf(level.levelCode));
          continue;
        }
        const code = matchLevelCode(level.name) ?? matchLevelCode(level.code);
        if (!code) {
          resolved.push(null);
          unmapped.push({
            tenant: tenant.slug,
            kind: 'year level',
            name: level.name,
            code: level.code,
            reason: 'no national rung matches this name or code',
          });
          console.log(`    · ${stage.code}/${level.name} → UNMAPPED`);
          continue;
        }
        resolved.push(educationLevelOf(code));
        if (!DRY_RUN) {
          await prisma.yearLevel.update({
            where: { id: level.id },
            data: { levelCode: code },
          });
        }
        levelsMapped += 1;
        console.log(
          `    · ${stage.code}/${level.name} → ${code}  (school keeps calling it "${level.name}")`,
        );
      }

      // ---- stage band: only when its levels agree unanimously.
      if (isEducationLevel(stage.educationLevel)) {
        stagesSkipped += 1;
        continue;
      }
      const bands = [
        ...new Set(resolved.filter((b): b is EducationLevel => !!b)),
      ];
      if (bands.length === 1) {
        if (!DRY_RUN) {
          await prisma.stage.update({
            where: { id: stage.id },
            data: { educationLevel: bands[0] },
          });
        }
        stagesMapped += 1;
        console.log(`  stage ${stage.name} → ${bands[0]}`);
      } else {
        unmapped.push({
          tenant: tenant.slug,
          kind: 'stage',
          name: stage.name,
          code: stage.code,
          reason:
            bands.length === 0
              ? 'none of its year levels could be mapped'
              : `its year levels span ${bands.join(' + ')} — split the stage or set the band by hand`,
        });
        console.log(
          `  stage ${stage.name} → AMBIGUOUS (${bands.join(' + ') || 'nothing mapped'})`,
        );
      }
    }
    console.log('');
  }

  console.log('─'.repeat(70));
  console.log(
    `year levels: ${levelsMapped} mapped · ${levelsSkipped} already set · ${
      unmapped.filter((u) => u.kind === 'year level').length
    } unmapped`,
  );
  console.log(
    `stages:      ${stagesMapped} mapped · ${stagesSkipped} already set · ${
      unmapped.filter((u) => u.kind === 'stage').length
    } needing a decision`,
  );

  if (unmapped.length > 0) {
    console.log(
      '\nNeeds a human — set these from Academics → Academic structure:',
    );
    for (const u of unmapped) {
      console.log(
        `  [${u.tenant}] ${u.kind} "${u.name}" (${u.code}): ${u.reason}`,
      );
    }
  }
  if (DRY_RUN) console.log('\nDRY RUN — nothing was written.');
  console.log('');
}

main()
  .catch((error) => {
    console.error('\nBackfill failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
