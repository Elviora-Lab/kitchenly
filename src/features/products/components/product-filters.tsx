'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { normalizeProductSort } from '@/lib/products/sort';

import { Button } from '@/components/ui/button';

const SORT_OPTIONS = [
  { value: 'newly-added', label: 'Newly added' },
  { value: 'best-sellers', label: 'Best sellers' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price-asc', label: 'Price — low to high' },
  { value: 'price-desc', label: 'Price — high to low' },
] as const;

export type BrandOption = { name: string; slug: string };

/**
 * Sort buttons plus (when the catalog has more than one brand) a brand
 * filter row. With a single-brand catalog the brand row hides itself, so
 * adding a second brand later lights this up with no code change.
 */
export function ProductFilters({ brands = [] }: { brands?: BrandOption[] }) {
  const router = useRouter();
  const search = useSearchParams();
  const activeSort = normalizeProductSort(search.get('sort'));
  const activeBrand = search.get('brand');

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(search.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete('page'); // reset pagination
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, search],
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      {brands.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-2">Brand</span>
          <Button
            size="sm"
            variant={!activeBrand ? 'primary' : 'outline'}
            className="rounded-full"
            onClick={() => setParam('brand', null)}
          >
            All brands
          </Button>
          {brands.map((b) => (
            <Button
              key={b.slug}
              size="sm"
              variant={activeBrand === b.slug ? 'primary' : 'outline'}
              className="rounded-full"
              onClick={() => setParam('brand', b.slug)}
            >
              {b.name}
            </Button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-2">Sort</span>
        {SORT_OPTIONS.map((o) => (
          <Button
            key={o.value}
            size="sm"
            variant={activeSort === o.value ? 'primary' : 'outline'}
            className="rounded-full"
            onClick={() => setParam('sort', o.value)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
