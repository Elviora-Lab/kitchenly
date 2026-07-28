import type { Metadata } from 'next';

import { routes } from '@/config/routes';

import { breadcrumbJsonLd, itemListJsonLd } from '@/lib/seo/json-ld';
import { JsonLd } from '@/lib/seo/json-ld-component';
import { buildMetadata } from '@/lib/seo/metadata';

import { Breadcrumb } from '@/design-system/primitives/breadcrumb';
import { Section } from '@/design-system/primitives/section';
import { CategoryViewTracker } from '@/components/analytics/pixel-trackers';

import {
  type SubcategoryChip,
  SubcategoryNav,
} from '@/features/categories/components/subcategory-nav';
import { InfiniteProducts } from '@/features/products/components/infinite-products';
import { ProductFilters } from '@/features/products/components/product-filters';

import { CatalogPagination } from '../../_components/catalog-pagination';

import { type ProductListSort } from '@/server/repositories/products.repo';
import { brandsService } from '@/server/services/brands.service';
import { categoriesService } from '@/server/services/categories.service';
import { productsService } from '@/server/services/products.service';

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SORTS: ProductListSort[] = ['newest', 'popular', 'rating', 'price-asc', 'price-desc'];
const str = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
const PAGE_SIZE = 24;

function prettify(slug: string) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const category = await categoriesService.getBySlug(slug);
  const name = category?.name ?? prettify(slug);
  // Self-referencing canonical per page (see /products for the rationale);
  // sort/brand variants still fold onto the clean category URL.
  const page = Math.max(1, Number(str(sp.page)) || 1);
  return buildMetadata({
    title: page > 1 ? `${name} — page ${page}` : name,
    description:
      category?.description ??
      `Shop ${name} at Kitchenly — practical, quality-checked essentials for your home.`,
    path: page > 1 ? `/categories/${slug}?page=${page}` : `/categories/${slug}`,
  });
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const sortParam = str(sp.sort);
  const sort: ProductListSort = SORTS.includes(sortParam as ProductListSort)
    ? (sortParam as ProductListSort)
    : 'newest';
  const page = Math.max(1, Number(str(sp.page)) || 1);

  // The category row drives the display name, description, and subcategory
  // chips; unknown slugs still render a (likely empty) product listing.
  const [category, { items, total }, brands] = await Promise.all([
    categoriesService.getBySlug(slug).catch(() => null),
    productsService
      .list({ category: slug, brand: str(sp.brand) }, sort, page, PAGE_SIZE)
      .catch(() => ({ items: [], total: 0 })),
    brandsService.list().catch(() => []),
  ]);

  const name = category?.name ?? prettify(slug);
  const parent = category?.parent ?? null;
  const children = category?.children ?? [];
  const siblings = parent?.children ?? [];

  // Parent page → chips for its subcategories ("All" = the page itself).
  // Subcategory page → chips for its siblings, current one highlighted.
  const chips: SubcategoryChip[] = children.length
    ? [
        { label: `All ${name}`, href: routes.category(slug), active: true },
        ...children.map((c) => ({ label: c.name, href: routes.category(c.slug) })),
      ]
    : parent
      ? [
          { label: `All ${parent.name}`, href: routes.category(parent.slug) },
          ...siblings.map((c) => ({
            label: c.name,
            href: routes.category(c.slug),
            active: c.slug === slug,
          })),
        ]
      : [];

  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Categories', href: '/categories' },
    ...(parent ? [{ label: parent.name, href: routes.category(parent.slug) }] : []),
    { label: name },
  ];

  return (
    <Section>
      <CategoryViewTracker slug={slug} name={name} />
      <div className="container flex flex-col gap-6 sm:gap-8">
        <Breadcrumb items={crumbs} />
        <header className="flex flex-col gap-2">
          <span className="eyebrow">{parent ? parent.name : 'Category'}</span>
          <h1 className="editorial-heading text-display-lg">{name}</h1>
          {category?.description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {category.description}
            </p>
          ) : null}
        </header>

        <SubcategoryNav chips={chips} />

        <ProductFilters brands={brands.map((b) => ({ name: b.name, slug: b.slug }))} />
        <InfiniteProducts
          key={`${slug}|${str(sp.brand) ?? ''}|${sort}`}
          initialProducts={items}
          total={total}
          pageSize={PAGE_SIZE}
          query={{ category: slug, brand: str(sp.brand), sort }}
          listId={`category_${slug}`}
          listName={name}
        />
        <noscript>
          <CatalogPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath={routes.category(slug)}
            params={{ brand: str(sp.brand), sort: str(sp.sort) }}
          />
        </noscript>

        <JsonLd
          data={breadcrumbJsonLd([
            { label: 'Home', href: '/' },
            { label: 'Categories', href: '/categories' },
            ...(parent ? [{ label: parent.name, href: routes.category(parent.slug) }] : []),
            { label: name, href: `/categories/${slug}` },
          ])}
        />
        {items.length > 0 ? (
          <JsonLd
            data={itemListJsonLd(
              items.map((p) => ({ name: p.name, slug: p.slug })),
              { path: `/categories/${slug}` },
            )}
          />
        ) : null}
      </div>
    </Section>
  );
}
