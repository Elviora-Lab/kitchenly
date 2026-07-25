import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

export type ProductListFilters = {
  category?: string; // slug
  brand?: string; // slug
  q?: string; // free-text
  priceMin?: number;
  priceMax?: number;
  // NOTE: no skinType filter — Product carries no skin-type data (only
  // skinConcerns). Add a relation before reintroducing it here.
  concern?: string; // skin-concern slug
  tag?: string; // tag slug
};

export type ProductListSort = 'newest' | 'price-asc' | 'price-desc' | 'popular' | 'rating';

/**
 * Escape LIKE/ILIKE wildcards in user search input — Prisma's `contains`
 * passes `%`/`_` through, so an unescaped `%` would match the entire catalog.
 */
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

const SORT_MAP: Record<ProductListSort, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  'price-asc': [{ price: 'asc' }],
  'price-desc': [{ price: 'desc' }],
  // Real engagement first (tracked product views), then the merchandised
  // bestseller flag, then recency as a stable tiebreak.
  popular: [{ viewLogs: { _count: 'desc' } }, { isFeatured: 'desc' }, { createdAt: 'desc' }],
  // Review volume as the rating proxy — Prisma can't order by relation
  // average; switch to a materialized rating column if one lands.
  rating: [{ reviews: { _count: 'desc' } }, { createdAt: 'desc' }],
};

export const productsRepo = {
  async list(filters: ProductListFilters, sort: ProductListSort, skip: number, take: number) {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      // Match against the full category membership (product_categories), not
      // just the primary categoryId — a product merchandised in several
      // categories must appear on each one's page.
      //
      // Match the category itself OR its direct parent, so a top-level page
      // (e.g. /categories/lips) rolls up products assigned to subcategories
      // (lipstick, liquid-lipstick). The taxonomy is one level deep.
      ...(filters.category
        ? {
            categories: {
              some: {
                category: {
                  OR: [{ slug: filters.category }, { parent: { slug: filters.category } }],
                },
              },
            },
          }
        : {}),
      ...(filters.brand ? { brand: { slug: filters.brand } } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: escapeLike(filters.q), mode: 'insensitive' } },
              { shortDescription: { contains: escapeLike(filters.q), mode: 'insensitive' } },
            ],
          }
        : {}),
      // Price filters match the TRANSACTABLE price: a product qualifies when
      // at least one active variant falls in the range. Product.price is a
      // display/master price and can drift from what's actually chargeable.
      ...(filters.priceMin !== undefined || filters.priceMax !== undefined
        ? {
            variants: {
              some: {
                isActive: true,
                price: {
                  ...(filters.priceMin !== undefined ? { gte: filters.priceMin } : {}),
                  ...(filters.priceMax !== undefined ? { lte: filters.priceMax } : {}),
                },
              },
            },
          }
        : {}),
      ...(filters.concern
        ? { skinConcerns: { some: { skinConcern: { slug: filters.concern } } } }
        : {}),
      ...(filters.tag ? { tagMappings: { some: { tag: { slug: filters.tag } } } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: SORT_MAP[sort],
        skip,
        take,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          brand: { select: { name: true, slug: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total };
  },

  async findBySlug(slug: string) {
    return prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        brand: true,
        variants: { where: { isActive: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        skinConcerns: { include: { skinConcern: true } },
        ingredients: { include: { ingredient: true } },
        tagMappings: { include: { tag: true } },
      },
    });
  },

  /** Lean lookup for the related-products path: just the keys, no relations. */
  async findIdAndCategory(slug: string) {
    return prisma.product.findUnique({
      where: { slug },
      select: { id: true, categoryId: true },
    });
  },

  async findRelated(productId: string, categoryId: string | null, limit: number) {
    return prisma.product.findMany({
      where: {
        isActive: true,
        id: { not: productId },
        ...(categoryId ? { categoryId } : {}),
      },
      take: limit,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        brand: { select: { name: true } },
      },
    });
  },
};
