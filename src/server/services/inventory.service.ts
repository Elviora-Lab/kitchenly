import 'server-only';

import { type Prisma, type StockMovementReason } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Stock ledger — the only place `product_variants.stock_quantity` is written.
 *
 * Every change posts an immutable `stock_movements` row in the same statement
 * as the update, so the cached column and the history cannot drift apart:
 * `SUM(delta)` per variant always equals `stock_quantity` (see `findDrift`).
 *
 * Callers must not write `stockQuantity` through the Prisma model. Checkout,
 * order transitions, the admin form and the importers all route through here.
 *
 * Every parameter below carries an explicit `::type` cast. Postgres will not
 * always infer a placeholder's type inside `INSERT ... SELECT`, and an
 * uncast NULL fails outright.
 */

/** What caused a movement. Free-form by design — purchasing adds its own. */
export type StockRefType = 'ORDER' | 'MANUAL' | 'IMPORT' | 'MIGRATION' | 'GOODS_RECEIPT';

type MovementInput = {
  variantId: string;
  reason: StockMovementReason;
  refType?: StockRefType;
  refId?: string | null;
  unitCost?: Prisma.Decimal | number | null;
  note?: string | null;
  createdBy?: string | null;
};

type BalanceRow = { balance_after: number };

/**
 * Apply a signed change to a variant's stock and record it.
 *
 * Returns the resulting balance, or `null` when nothing was written — either
 * the variant is gone or the change would drive stock negative. The guard
 * lives in the UPDATE's WHERE clause, so two callers racing for the last unit
 * cannot both win; the loser matches zero rows instead of corrupting the count.
 *
 * A refused decrement is a normal outcome (someone else bought it first), not
 * an error, so the caller decides how to surface it.
 */
export async function applyDelta(
  input: MovementInput & { delta: number },
  tx?: Prisma.TransactionClient,
): Promise<number | null> {
  const { variantId, delta, reason, refType, refId, unitCost, note, createdBy } = input;
  const db = tx ?? prisma;

  if (!Number.isInteger(delta)) {
    throw new Error(`Stock delta must be a whole number, got ${delta}`);
  }
  // Zero is a no-op that the delta CHECK constraint would reject. Report the
  // current balance rather than writing an empty history row.
  if (delta === 0) {
    const variant = await db.productVariant.findUnique({
      where: { id: variantId },
      select: { stockQuantity: true },
    });
    return variant?.stockQuantity ?? null;
  }

  const cost = unitCost === null || unitCost === undefined ? null : Number(unitCost);

  const rows = await db.$queryRaw<BalanceRow[]>`
    WITH upd AS (
      UPDATE "product_variants"
      SET "stock_quantity" = "stock_quantity" + ${delta}::int
      WHERE "id" = ${variantId}::uuid
        AND "stock_quantity" + ${delta}::int >= 0
      RETURNING "id", "stock_quantity"
    )
    INSERT INTO "stock_movements"
      ("variant_id", "delta", "balance_after", "reason", "ref_type", "ref_id", "unit_cost", "note", "created_by")
    SELECT
      upd."id",
      ${delta}::int,
      upd."stock_quantity",
      ${reason}::"stock_movement_reason",
      ${refType ?? null}::varchar(24),
      ${refId ?? null}::uuid,
      ${cost}::decimal(12,2),
      ${note ?? null}::text,
      ${createdBy ?? null}::uuid
    FROM upd
    RETURNING "balance_after"`;

  return rows[0]?.balance_after ?? null;
}

/**
 * Set stock to an absolute figure — what a human means by "there are 42 on the
 * shelf". The delta is derived from the locked current value, so a sale landing
 * mid-edit is not silently overwritten, and a no-op writes no history.
 */
export async function setLevel(
  input: MovementInput & { quantity: number },
  tx?: Prisma.TransactionClient,
): Promise<number> {
  const { variantId, quantity, ...rest } = input;

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Stock quantity must be a non-negative whole number, got ${quantity}`);
  }

  const run = async (db: Prisma.TransactionClient) => {
    // FOR UPDATE holds the row until the transaction commits, so the delta we
    // compute is still true by the time it is written.
    const locked = await db.$queryRaw<Array<{ stock_quantity: number }>>`
      SELECT "stock_quantity" FROM "product_variants" WHERE "id" = ${variantId}::uuid FOR UPDATE`;
    const before = locked[0]?.stock_quantity;
    if (before === undefined) throw new Error(`Variant ${variantId} not found`);

    const delta = quantity - before;
    if (delta === 0) return quantity;

    const after = await applyDelta({ ...rest, variantId, delta }, db);
    // The guard can only refuse a negative result, which the check above rules
    // out — so a null here means the row vanished under the lock.
    if (after === null) throw new Error(`Variant ${variantId} not found`);
    return after;
  };

  return tx ? run(tx) : prisma.$transaction(run);
}

/**
 * Put an order's stock back on the shelf, one movement per line.
 *
 * Set-based on purpose: restores run inside a wider transaction (the order
 * status flip), so this keeps the lock window to a single statement rather
 * than a round trip per variant. Lines whose variant has since been deleted
 * are skipped — the join simply doesn't match them.
 *
 * Returns the number of variants credited.
 */
export async function restoreForOrder(
  orderId: string,
  tx?: Prisma.TransactionClient,
  createdBy?: string | null,
): Promise<number> {
  const db = tx ?? prisma;

  const rows = await db.$queryRaw<BalanceRow[]>`
    WITH lines AS (
      SELECT "variant_id", SUM("quantity")::int AS qty
      FROM "order_items"
      WHERE "order_id" = ${orderId}::uuid AND "variant_id" IS NOT NULL
      GROUP BY "variant_id"
    ), upd AS (
      UPDATE "product_variants" pv
      SET "stock_quantity" = pv."stock_quantity" + lines.qty
      FROM lines
      WHERE pv."id" = lines."variant_id"
      RETURNING pv."id", pv."stock_quantity", lines.qty
    )
    INSERT INTO "stock_movements"
      ("variant_id", "delta", "balance_after", "reason", "ref_type", "ref_id", "created_by")
    SELECT
      upd."id",
      upd.qty,
      upd."stock_quantity",
      'ORDER_RESTOCK'::"stock_movement_reason",
      'ORDER',
      ${orderId}::uuid,
      ${createdBy ?? null}::uuid
    FROM upd
    RETURNING "balance_after"`;

  return rows.length;
}

/** Shop-wide reorder point for variants that don't set their own. */
const LOW_STOCK_KEY = 'inventory.low_stock_threshold';
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

export const inventoryService = {
  applyDelta,
  setLevel,
  restoreForOrder,

  async lowStockThreshold(): Promise<number> {
    const row = await prisma.appSetting.findUnique({ where: { key: LOW_STOCK_KEY } });
    const parsed = Number(row?.value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_LOW_STOCK_THRESHOLD;
  },

  async setLowStockThreshold(value: number): Promise<void> {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Threshold must be a non-negative whole number, got ${value}`);
    }
    await prisma.appSetting.upsert({
      where: { key: LOW_STOCK_KEY },
      update: { value: String(value) },
      create: { key: LOW_STOCK_KEY, value: String(value) },
    });
  },

  /** Movement history for a variant, newest first. */
  history(variantId: string, limit = 100) {
    return prisma.stockMovement.findMany({
      where: { variantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { actor: { select: { firstName: true, lastName: true, email: true } } },
    });
  },

  /**
   * Variants whose ledger disagrees with the cached column. Should always come
   * back empty — anything here means something wrote `stock_quantity` outside
   * this service, and the movement history for that variant is incomplete.
   */
  findDrift(limit = 50) {
    return prisma.$queryRaw<Array<{ variant_id: string; cached: number; ledger: number }>>`
      SELECT pv."id" AS variant_id,
             pv."stock_quantity" AS cached,
             COALESCE(SUM(sm."delta"), 0)::int AS ledger
      FROM "product_variants" pv
      LEFT JOIN "stock_movements" sm ON sm."variant_id" = pv."id"
      GROUP BY pv."id", pv."stock_quantity"
      HAVING pv."stock_quantity" <> COALESCE(SUM(sm."delta"), 0)::int
      LIMIT ${limit}::int`;
  },
};
