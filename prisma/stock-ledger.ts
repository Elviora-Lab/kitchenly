import { type PrismaClient } from '@prisma/client';

/**
 * Post opening-balance movements for any variant whose ledger doesn't match
 * its cached `stock_quantity`.
 *
 * Seed and import scripts write stock straight onto the column — they run
 * outside the app, where `inventory.service.ts` (and its `server-only` import)
 * can't reach. Calling this once at the end of a script leaves the database in
 * the same reconciled state the application maintains, so `findDrift` stays
 * meaningful in development.
 *
 * Idempotent: a second run finds nothing to correct.
 */
export async function reconcileStockLedger(prisma: PrismaClient): Promise<number> {
  const inserted = await prisma.$executeRaw`
    INSERT INTO "stock_movements" ("variant_id", "delta", "balance_after", "reason", "ref_type", "note")
    SELECT pv."id",
           pv."stock_quantity" - COALESCE(SUM(sm."delta"), 0)::int,
           pv."stock_quantity",
           'OPENING_BALANCE',
           'IMPORT',
           'Reconciled from seed/import data'
    FROM "product_variants" pv
    LEFT JOIN "stock_movements" sm ON sm."variant_id" = pv."id"
    GROUP BY pv."id", pv."stock_quantity"
    HAVING pv."stock_quantity" <> COALESCE(SUM(sm."delta"), 0)::int`;

  return inserted;
}
