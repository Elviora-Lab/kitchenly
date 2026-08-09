import 'server-only';

import { prisma } from '@/lib/db';

export const blogRepo = {
  listPublished(take = 24) {
    return prisma.blogPost.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      take,
      select: {
        id: true,
        title: true,
        slug: true,
        thumbnail: true,
        seoDescription: true,
        content: true,
        publishedAt: true,
      },
    });
  },

  findPublishedBySlug(slug: string) {
    return prisma.blogPost.findFirst({ where: { slug, isPublished: true } });
  },

  /**
   * Published posts for a fixed set of slugs — the "related guides" rails on
   * category and product pages. Titles come from the DB rather than the link
   * config so a renamed post can never leave a stale label behind, and an
   * unpublished slug simply drops out of the rail instead of 404-ing.
   */
  listBySlugs(slugs: string[]) {
    if (slugs.length === 0) return Promise.resolve([]);
    return prisma.blogPost.findMany({
      where: { slug: { in: slugs }, isPublished: true },
      select: { title: true, slug: true },
    });
  },
};
