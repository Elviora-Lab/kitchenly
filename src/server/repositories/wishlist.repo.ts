import 'server-only';

import { prisma } from '@/lib/db';

export const wishlistRepo = {
  /**
   * Wishlist rows joined with the product card fields (primary image + brand
   * name). Selects exactly what `toProductCard` reads — not the full row.
   */
  listForUser(userId: string) {
    return prisma.wishlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            price: true,
            comparePrice: true,
            isFeatured: true,
            createdAt: true,
            brand: { select: { name: true } },
            images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
          },
        },
      },
    });
  },

  /** Just the productIds — used by the Hydrator to keep the heart icons in sync. */
  async productIdsForUser(userId: string): Promise<string[]> {
    const rows = await prisma.wishlist.findMany({
      where: { userId },
      select: { productId: true },
    });
    return rows.map((r) => r.productId);
  },

  add(userId: string, productId: string) {
    return prisma.wishlist.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
    });
  },

  remove(userId: string, productId: string) {
    return prisma.wishlist.deleteMany({ where: { userId, productId } });
  },
};
