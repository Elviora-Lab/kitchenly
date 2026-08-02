import 'server-only';

import { type Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

export type StockFilter = 'all' | 'low' | 'out';

const variantSelect = {
  id: true,
  sku: true,
  size: true,
  shade: true,
  fragrance: true,
  stockQuantity: true,
  reorderPoint: true,
  reorderQuantity: true,
  avgCost: true,
  isActive: true,
  product: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductVariantSelect;

export const inventoryRepo = {
  /**
   * Stock levels for the admin list.
   *
   * "Low" compares against the variant's own reorder point, falling back to the
   * shop-wide default for variants that have never had one set — which is most
   * of them, so the fallback does the real work here.
   */
  async listLevels(opts: {
    q?: string;
    filter?: StockFilter;
    defaultThreshold: number;
    skip: number;
    take: number;
  }) {
    const { q, filter = 'all', defaultThreshold, skip, take } = opts;

    const search: Prisma.ProductVariantWhereInput = q
      ? {
          OR: [
            { sku: { contains: q, mode: 'insensitive' } },
            { product: { name: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {};

    const stockFilter: Prisma.ProductVariantWhereInput =
      filter === 'out'
        ? { stockQuantity: { lte: 0 } }
        : filter === 'low'
          ? {
              OR: [
                { reorderPoint: { not: null }, ...belowOwnReorderPoint() },
                { reorderPoint: null, stockQuantity: { lte: defaultThreshold } },
              ],
            }
          : {};

    const where: Prisma.ProductVariantWhereInput = { AND: [search, stockFilter] };

    const [items, total] = await Promise.all([
      prisma.productVariant.findMany({
        where,
        select: variantSelect,
        orderBy: [{ stockQuantity: 'asc' }, { sku: 'asc' }],
        skip,
        take,
      }),
      prisma.productVariant.count({ where }),
    ]);

    return { items, total };
  },

  findVariant(variantId: string) {
    return prisma.productVariant.findUnique({ where: { id: variantId }, select: variantSelect });
  },

  /**
   * How many active variants need reordering. Raw SQL because the comparison
   * is column-against-column with a fallback, which Prisma's filters can't
   * express.
   */
  async lowStockCount(defaultThreshold: number): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM "product_variants"
      WHERE "is_active" = true
        AND "stock_quantity" <= COALESCE("reorder_point", ${defaultThreshold}::int)`;
    return Number(rows[0]?.count ?? 0);
  },

  /**
   * Value of stock on hand at moving-average cost.
   *
   * Variants with no average cost yet (nothing ever received through
   * purchasing) contribute nothing and are counted separately, so the figure
   * is never quietly understated without saying so.
   */
  async valuation() {
    const rows = await prisma.$queryRaw<
      Array<{ total_value: string | null; costed_units: bigint; uncosted_units: bigint }>
    >`
      SELECT
        SUM("stock_quantity" * "avg_cost") FILTER (WHERE "avg_cost" IS NOT NULL) AS total_value,
        COALESCE(SUM("stock_quantity") FILTER (WHERE "avg_cost" IS NOT NULL), 0) AS costed_units,
        COALESCE(SUM("stock_quantity") FILTER (WHERE "avg_cost" IS NULL), 0) AS uncosted_units
      FROM "product_variants"
      WHERE "stock_quantity" > 0`;

    const row = rows[0];
    return {
      totalValue: Number(row?.total_value ?? 0),
      costedUnits: Number(row?.costed_units ?? 0),
      uncostedUnits: Number(row?.uncosted_units ?? 0),
    };
  },

  /** Variants needing a reorder, with their preferred supplier if one is set. */
  async reorderSuggestions(defaultThreshold: number, limit = 100) {
    return prisma.$queryRaw<
      Array<{
        variant_id: string;
        sku: string;
        product_name: string;
        stock_quantity: number;
        reorder_point: number;
        reorder_quantity: number | null;
        supplier_id: string | null;
        supplier_name: string | null;
        unit_cost: string | null;
      }>
    >`
      SELECT pv."id" AS variant_id,
             pv."sku",
             p."name" AS product_name,
             pv."stock_quantity",
             COALESCE(pv."reorder_point", ${defaultThreshold}::int) AS reorder_point,
             pv."reorder_quantity",
             s."id" AS supplier_id,
             s."name" AS supplier_name,
             sv."unit_cost"
      FROM "product_variants" pv
      JOIN "products" p ON p."id" = pv."product_id"
      LEFT JOIN "supplier_variants" sv ON sv."variant_id" = pv."id" AND sv."is_preferred"
      LEFT JOIN "suppliers" s ON s."id" = sv."supplier_id"
      WHERE pv."is_active" = true
        AND pv."stock_quantity" <= COALESCE(pv."reorder_point", ${defaultThreshold}::int)
      ORDER BY pv."stock_quantity" ASC, p."name" ASC
      LIMIT ${limit}::int`;
  },

  /** Newest movements across the whole catalog — the activity feed. */
  recentMovements(limit = 50) {
    return prisma.stockMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        variant: { select: { sku: true, product: { select: { name: true } } } },
        actor: { select: { firstName: true, lastName: true, email: true } },
      },
    });
  },
};

/**
 * `stock_quantity <= reorder_point` as a Prisma filter. Comparing two columns
 * isn't expressible, so this leans on the generated raw fragment Prisma allows
 * inside `where`.
 */
function belowOwnReorderPoint(): Prisma.ProductVariantWhereInput {
  return {
    stockQuantity: { lte: prisma.productVariant.fields.reorderPoint },
  };
}
