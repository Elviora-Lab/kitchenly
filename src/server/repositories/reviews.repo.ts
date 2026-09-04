import 'server-only';

import { prisma } from '@/lib/db';

export const reviewsRepo = {
  /** Approved reviews for a product, newest first, with the author's name. */
  listApproved(productId: string, take = 10) {
    return prisma.review.findMany({
      where: { productId, isApproved: true },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        isVerifiedPurchase: true,
        createdAt: true,
        authorName: true,
        user: { select: { firstName: true, lastName: true } },
        images: { select: { id: true, imageUrl: true } },
      },
    });
  },

  /** Average rating + count over approved reviews. */
  async summary(productId: string) {
    const agg = await prisma.review.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return { average: agg._avg.rating ?? 0, count: agg._count.rating };
  },

  /**
   * Recent, highly-rated approved reviews across the whole catalog — powers the
   * homepage social-proof carousel. Only reviews with a written comment.
   */
  recentApproved(take = 12) {
    return prisma.review.findMany({
      where: { isApproved: true, rating: { gte: 4 }, comment: { not: null } },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        rating: true,
        title: true,
        comment: true,
        isVerifiedPurchase: true,
        authorName: true,
        user: { select: { firstName: true } },
        product: {
          select: {
            name: true,
            slug: true,
            images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
          },
        },
      },
    });
  },

  /** Store-wide average rating + count over all approved reviews. */
  async globalSummary() {
    const agg = await prisma.review.aggregate({
      where: { isApproved: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return { average: agg._avg.rating ?? 0, count: agg._count.rating };
  },
};
