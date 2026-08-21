import { prisma } from '../../src/singleton.js';

/**
 * Backfill: give existing fee items the price they are already being billed at.
 *
 * `FeeItem.pricingMode` made the catalogue the authority on price: an invoice
 * line is billed at the item's `default_amount`, so an item without one cannot
 * be billed at all. That is the intended rule, but the migration that
 * introduced it defaulted every existing item to `fixed` with the price it
 * already had — which for most was NULL. Each school would otherwise discover
 * mid-invoice that its catalogue is unusable.
 *
 * It does not invent prices. A school's fees are its own, and a wrong figure on
 * a bill is far worse than a null. Instead it reads what that school has
 * ACTUALLY charged for the item — its own invoice lines — and adopts that.
 *
 * How the figure is chosen:
 *   · Lines from the last 12 months, falling back to all history when the
 *     recent window is empty. A price raised this year should win over the one
 *     charged for three years before it.
 *   · The most frequently billed amount, tie-broken by the most recent — so a
 *     single mistyped override cannot become the catalogue price.
 *
 * Three outcomes, and only the first writes a price:
 *   · CONSISTENT   → the modal amount is adopted.
 *   · VARIABLE     → the amounts genuinely disagree, which is what an
 *                    open-priced item looks like (excursions, damages). Left
 *                    alone and reported, unless --open-variable is passed.
 *   · NO HISTORY   → never billed, so there is nothing to learn from. Left for
 *                    the school to price.
 *
 * Idempotent: items that already carry a price are skipped, so re-running only
 * picks up what is still unpriced and never overwrites a figure a human set.
 *
 * Usage (never against production without a current backup):
 *   DATABASE_URL="$URL" pnpm --filter @workspace/database db:backfill:fee-item-prices -- --dry-run
 *   …drop --dry-run to write; add --open-variable to also switch genuinely
 *   variable items to open pricing.
 */

const DRY_RUN = process.argv.includes('--dry-run');
const OPEN_VARIABLE = process.argv.includes('--open-variable');

/** How far back "current pricing" reaches before we fall back to all history. */
const RECENT_MONTHS = 12;

/**
 * How dominant the modal amount must be to count as this item's price.
 * Below this, with several distinct amounts, the item is priced per invoice in
 * practice whatever the catalogue says.
 */
const CONSISTENT_SHARE = 0.6;
const VARIABLE_DISTINCT_MIN = 3;

type Verdict =
  | { kind: 'consistent'; amount: number; share: number; sample: number }
  | { kind: 'variable'; distinct: number; sample: number; top: number }
  | { kind: 'no-history' };

interface Line {
  amount: number;
  createdAt: Date;
}

/** What this school actually charges for the item, judged from its own bills. */
function judge(all: Line[]): Verdict {
  if (all.length === 0) return { kind: 'no-history' };

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RECENT_MONTHS);
  const recent = all.filter((l) => l.createdAt >= cutoff);
  const lines = recent.length > 0 ? recent : all;

  const tally = new Map<number, { count: number; latest: Date }>();
  for (const line of lines) {
    const seen = tally.get(line.amount);
    if (!seen) tally.set(line.amount, { count: 1, latest: line.createdAt });
    else {
      seen.count += 1;
      if (line.createdAt > seen.latest) seen.latest = line.createdAt;
    }
  }

  // Most frequent first; a tie goes to whichever was billed most recently.
  const ranked = [...tally.entries()].sort(
    (a, b) =>
      b[1].count - a[1].count || b[1].latest.getTime() - a[1].latest.getTime(),
  );
  const [amount, top] = ranked[0]!;
  const share = top.count / lines.length;

  if (share < CONSISTENT_SHARE && tally.size >= VARIABLE_DISTINCT_MIN) {
    return {
      kind: 'variable',
      distinct: tally.size,
      sample: lines.length,
      top: amount,
    };
  }
  return { kind: 'consistent', amount, share, sample: lines.length };
}

const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

async function main() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host || '(unknown)';
    } catch {
      return '(unknown)';
    }
  })();
  console.log(
    `\nBackfilling fee-item prices on ${host}${DRY_RUN ? ' (DRY RUN — no writes)' : ''}\n`,
  );

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });

  let priced = 0;
  let openedUp = 0;
  const needsAHuman: {
    tenant: string;
    item: string;
    reason: string;
  }[] = [];

  for (const tenant of tenants) {
    // Only fixed-and-unpriced items are candidates: an item someone has
    // already priced, or deliberately made open, is left exactly as it is.
    const items = await prisma.feeItem.findMany({
      where: {
        tenantId: tenant.id,
        defaultAmount: null,
        pricingMode: 'fixed',
      },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
    if (items.length === 0) continue;

    console.log(`${tenant.name} (${tenant.slug ?? tenant.id})`);

    for (const item of items) {
      const lines = await prisma.feeInvoiceLine.findMany({
        where: { tenantId: tenant.id, feeItemId: item.id },
        select: { amount: true, createdAt: true },
      });

      const verdict = judge(lines);

      if (verdict.kind === 'consistent') {
        if (!DRY_RUN) {
          await prisma.feeItem.update({
            where: { id: item.id },
            data: { defaultAmount: verdict.amount },
          });
        }
        priced += 1;
        console.log(
          `    · ${item.name} → ${naira(verdict.amount)} ` +
            `(${Math.round(verdict.share * 100)}% of ${verdict.sample} line(s))`,
        );
        continue;
      }

      if (verdict.kind === 'variable') {
        if (OPEN_VARIABLE) {
          if (!DRY_RUN) {
            await prisma.feeItem.update({
              where: { id: item.id },
              data: { pricingMode: 'open', defaultAmount: null },
            });
          }
          openedUp += 1;
          console.log(
            `    · ${item.name} → priced per invoice ` +
              `(${verdict.distinct} different amounts across ${verdict.sample} line(s))`,
          );
        } else {
          needsAHuman.push({
            tenant: tenant.slug ?? tenant.id,
            item: item.name,
            reason:
              `billed at ${verdict.distinct} different amounts ` +
              `(most common ${naira(verdict.top)}) — looks priced per invoice`,
          });
          console.log(`    · ${item.name} → VARIABLE, left alone`);
        }
        continue;
      }

      needsAHuman.push({
        tenant: tenant.slug ?? tenant.id,
        item: item.name,
        reason: 'never billed — nothing to learn a price from',
      });
      console.log(`    · ${item.name} → NO HISTORY, left alone`);
    }
    console.log('');
  }

  console.log('─'.repeat(60));
  console.log(`Priced from billing history : ${priced}`);
  if (OPEN_VARIABLE) console.log(`Switched to per-invoice     : ${openedUp}`);
  console.log(`Still needing a human       : ${needsAHuman.length}`);

  if (needsAHuman.length > 0) {
    console.log(
      '\nThese cannot be billed until someone prices them on the fee items page:',
    );
    for (const row of needsAHuman) {
      console.log(`  · ${row.tenant} — ${row.item}: ${row.reason}`);
    }
    if (!OPEN_VARIABLE) {
      console.log(
        '\n  Re-run with --open-variable to switch the variable ones to per-invoice pricing.',
      );
    }
  }
  console.log(DRY_RUN ? '\nDRY RUN — nothing was written.\n' : '\nDone.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
