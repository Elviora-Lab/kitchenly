export const PRODUCT_SORT_VALUES = [
  'newly-added',
  'best-sellers',
  'price-asc',
  'price-desc',
  'rating',
  // Legacy URL/API aliases kept so old links continue to work.
  'newest',
  'popular',
] as const;

export type ProductListSort = (typeof PRODUCT_SORT_VALUES)[number];
export type CanonicalProductListSort =
  | 'newly-added'
  | 'best-sellers'
  | 'price-asc'
  | 'price-desc'
  | 'rating';

export function normalizeProductSort(sort?: string | null): CanonicalProductListSort {
  switch (sort) {
    case 'popular':
    case 'best-sellers':
      return 'best-sellers';
    case 'newest':
    case 'newly-added':
      return 'newly-added';
    case 'price-asc':
    case 'price-desc':
    case 'rating':
      return sort;
    default:
      return 'newly-added';
  }
}
