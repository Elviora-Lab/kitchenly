import { describe, expect, it } from 'vitest';

import { normalizeProductSort } from '@/lib/products/sort';

import { productListQuery } from '@/server/validators/products.schema';

describe('product sort options', () => {
  it('normalizes legacy sort URLs to the current storefront options', () => {
    expect(normalizeProductSort('popular')).toBe('best-sellers');
    expect(normalizeProductSort('newest')).toBe('newly-added');
  });

  it('keeps the current sort values stable', () => {
    expect(normalizeProductSort('best-sellers')).toBe('best-sellers');
    expect(normalizeProductSort('newly-added')).toBe('newly-added');
    expect(normalizeProductSort('price-asc')).toBe('price-asc');
  });

  it('accepts both current and legacy sort values at the API boundary', () => {
    expect(productListQuery.parse({ sort: 'best-sellers' }).sort).toBe('best-sellers');
    expect(productListQuery.parse({ sort: 'newly-added' }).sort).toBe('newly-added');
    expect(productListQuery.parse({ sort: 'popular' }).sort).toBe('popular');
    expect(productListQuery.parse({ sort: 'newest' }).sort).toBe('newest');
  });

  it('defaults catalog requests to newly added products', () => {
    expect(productListQuery.parse({}).sort).toBe('newly-added');
  });
});
