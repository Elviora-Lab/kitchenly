/**
 * Backfill — sets `compare_price` on products that don't have one, at a random
 * 10–15% above `price` so the storefront's sale UI (strikethrough + discount
 * badge) lights up.
 *
 * Run with `npm run db:backfill:compare`. Idempotent: only touches rows where
 * `compare_price IS NULL`, so scraped compare-at prices are never overwritten
 * and a re-run reports 0 updates.
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MIN_MARKUP = 1.1;
const MAX_MARKUP = 1.15;
const CHUNK_SIZE = 50;

/** Markup `price` by 10–15% and round to the nearest Rs 10 so the
 *  strikethrough value reads like a real price, never landing at or
 *  below the selling price. */
function compareAtFor(price: number): number {
  const factor = MIN_MARKUP + Math.random() * (MAX_MARKUP - MIN_MARKUP);
  const rounded = Math.round((price * factor) / 10) * 10;
  return rounded > price ? rounded : Math.floor(price / 10) * 10 + 10;
}

async function main() {
  const total = await prisma.product.count();
  const targets = await prisma.product.findMany({
    where: { comparePrice: null },
    select: { id: true, name: true, price: true },
  });

  console.log(
    `[backfill] ${total} products total, ${targets.length} without compare_price, ` +
      `${total - targets.length} skipped (already set)`,
  );

  const samples: { name: string; price: number; compareAt: number }[] = [];
  let updated = 0;

  for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
    const chunk = targets.slice(i, i + CHUNK_SIZE);
    await prisma.$transaction(
      chunk.map((p) => {
        const compareAt = compareAtFor(p.price.toNumber());
        if (samples.length < 5) {
          samples.push({ name: p.name, price: p.price.toNumber(), compareAt });
        }
        return prisma.product.update({
          where: { id: p.id },
          data: { comparePrice: new Prisma.Decimal(compareAt) },
        });
      }),
    );
    updated += chunk.length;
    console.log(`[backfill] ${updated}/${targets.length} updated`);
  }

  if (samples.length > 0) {
    console.log('[backfill] samples:');
    for (const s of samples) {
      const pct = (((s.compareAt - s.price) / s.price) * 100).toFixed(1);
      console.log(`  ${s.name}: Rs ${s.price} → compare at Rs ${s.compareAt} (+${pct}%)`);
    }
  }
  console.log('[backfill] done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
