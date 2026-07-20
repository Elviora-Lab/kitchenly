import 'server-only';

import { type Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

/** Product shape the homepage card needs, joined through the sale item. */
const saleItemInclude = {
  product: {
    include: {
      images: { orderBy: { sortOrder: 'asc' }, take: 2 },
      variants: {
        where: { isActive: true },
        orderBy: { price: 'asc' },
        select: { id: true, price: true, stockQuantity: true },
      },
    },
  },
} satisfies Prisma.FlashSaleItemInclude;

export const flashSaleRepo = {
  /**
   * The sale that is selling right now, with its curated products. Start is
   * inclusive, end exclusive — the same boundary the countdown and
   * `isFlashSaleLive` use.
   */
  findLive(now: Date = new Date(), db: Prisma.TransactionClient = prisma) {
    return db.flashSale.findFirst({
      where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: 'desc' },
      include: { items: { orderBy: { position: 'asc' }, include: saleItemInclude } },
    });
  },

  /**
   * Discount percent per product for the live sale — the money-path read.
   * Deliberately lean (no joins) and never cached: it runs inside the checkout
   * transaction, where a stale answer would mis-charge a customer.
   */
  async liveDiscountsByProduct(
    productIds: string[],
    now: Date = new Date(),
    db: Prisma.TransactionClient = prisma,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (productIds.length === 0) return map;

    const rows = await db.flashSaleItem.findMany({
      where: {
        productId: { in: productIds },
        flashSale: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
      },
      select: { productId: true, discountPercent: true },
    });
    for (const row of rows) map.set(row.productId, row.discountPercent);
    return map;
  },
};

export const adminFlashSaleRepo = {
  /** Every sale, newest window first, for the admin list. */
  list() {
    return prisma.flashSale.findMany({
      orderBy: { startsAt: 'desc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                price: true,
                images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { imageUrl: true } },
              },
            },
          },
        },
      },
    });
  },

  findById(id: string) {
    return prisma.flashSale.findUnique({ where: { id }, include: { items: true } });
  },

  create(data: { title: string; startsAt: Date; endsAt: Date; isActive: boolean }) {
    return prisma.flashSale.create({ data });
  },

  update(
    id: string,
    data: Partial<{ title: string; startsAt: Date; endsAt: Date; isActive: boolean }>,
  ) {
    return prisma.flashSale.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.flashSale.delete({ where: { id } });
  },

  /** Deactivate every other sale — keeps at most one window live at a time. */
  deactivateOthers(exceptId: string) {
    return prisma.flashSale.updateMany({
      where: { id: { not: exceptId }, isActive: true },
      data: { isActive: false },
    });
  },

  /**
   * Replace the sale's curated list wholesale. Simpler and safer than diffing:
   * the admin UI always submits the full ordered set, and the delete+create runs
   * in one transaction so the sale is never briefly empty for shoppers.
   */
  replaceItems(flashSaleId: string, items: Array<{ productId: string; discountPercent: number }>) {
    return prisma.$transaction([
      prisma.flashSaleItem.deleteMany({ where: { flashSaleId } }),
      prisma.flashSaleItem.createMany({
        data: items.map((item, index) => ({
          flashSaleId,
          productId: item.productId,
          discountPercent: item.discountPercent,
          position: index,
        })),
      }),
    ]);
  },

  /** Type-ahead source for the product picker. Active products only. */
  searchProducts(query: string, limit: number) {
    return prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { imageUrl: true } },
      },
    });
  },
};
