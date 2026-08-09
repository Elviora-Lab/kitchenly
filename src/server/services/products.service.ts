import 'server-only';

import { toProductCard } from './_mappers/product.mapper';

import { cache } from '@/server/cache';
import { events } from '@/server/events';
import { NotFoundError } from '@/server/http/errors';
import {
  type ProductListFilters,
  type ProductListSort,
  productsRepo,
} from '@/server/repositories/products.repo';

// Product lists are the hottest read path (homepage fires 3–7, catalog +
// category + brand pages one each). The rows change rarely relative to how
// often they're read, so we cache the projected result for a short window.
// Correlated `_count` sorts (popular/rating) are the most expensive queries in
// the app, so this cache disproportionately helps them.
const LIST_TTL_SECONDS = 120;
// A monotonically bumped version prefixes every list key, so a single write
// (`invalidateLists`) logically drops ALL cached lists at once without having
// to enumerate/scan keys — the orphaned entries simply age out via their TTL.
const LIST_VERSION_KEY = 'products:list:ver';
const LIST_VERSION_TTL_SECONDS = 86_400;

async function currentListVersion(): Promise<number> {
  return (await cache.get<number>(LIST_VERSION_KEY)) ?? 1;
}

export const productsService = {
  /**
   * Returns products in the `ProductCardData` shape — already projected so
   * the client doesn't have to know about Prisma's row layout (`images[]`,
   * `Decimal`, etc.). `imageUrl` is guaranteed to be a string.
   *
   * Cached for {@link LIST_TTL_SECONDS}s (versioned — see `invalidateLists`).
   */
  async list(filters: ProductListFilters, sort: ProductListSort, page: number, pageSize: number) {
    const version = await currentListVersion();
    const key = `products:list:v${version}:${sort}:${page}:${pageSize}:${JSON.stringify(filters)}`;
    return cache.wrap(key, LIST_TTL_SECONDS, async () => {
      const skip = (page - 1) * pageSize;
      const { items, total } = await productsRepo.list(filters, sort, skip, pageSize);
      return { items: items.map(toProductCard), total };
    });
  },

  async getBySlug(
    slug: string,
    viewer: { userId?: string | null; track?: boolean; allowInactive?: boolean } = {},
  ) {
    const product = await cache.wrap(`product:${slug}`, 120, () => productsRepo.findBySlug(slug));
    if (!product) throw new NotFoundError('Product not found');

    // Hidden (isActive=false) products are not publicly reachable — treat them
    // as not-found for the storefront. Admin preview passes `allowInactive`.
    if (!product.isActive && !viewer.allowInactive) throw new NotFoundError('Product not found');

    // Count a view only for the actual page render — `generateMetadata` also
    // calls this and passes `track: false` to avoid double-counting.
    if (viewer.track !== false) {
      events.emit('product.viewed', { productId: product.id, userId: viewer.userId ?? null });
    }

    return product;
  },

  async getRelated(slug: string, limit = 4) {
    // Lean root lookup — the related query only needs the two keys, not the
    // full 7-relation detail row `findBySlug` loads. Cached like getBySlug;
    // 120s of staleness on a recommendation strip is harmless.
    const cards = await cache.wrap(`product:related:${slug}:${limit}`, 120, async () => {
      const root = await productsRepo.findRelatedSeed(slug);
      if (!root) return null;
      // Full category membership drives the ranking; the primary category is
      // only the fallback for topping up a short rail.
      const categoryIds = root.categories.map((c) => c.categoryId);
      const related = await productsRepo.findRelated(root, categoryIds, limit);
      return related.map(toProductCard);
    });
    if (!cards) throw new NotFoundError('Product not found');
    return cards;
  },

  /**
   * Drop a single product's cached detail AND every cached list (a product
   * write can change what appears in / how a list is ranked). Called by every
   * admin product mutation.
   */
  async invalidate(slug: string) {
    await Promise.all([cache.delete(`product:${slug}`), this.invalidateLists()]);
  },

  /**
   * Bump the list-cache version so all cached product lists are logically
   * invalidated at once. Use for writes that affect lists without a specific
   * slug (e.g. a brand-new product).
   */
  invalidateLists() {
    return cache.set(LIST_VERSION_KEY, Date.now(), LIST_VERSION_TTL_SECONDS);
  },
};
