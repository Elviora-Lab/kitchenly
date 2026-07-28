import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

import { prisma } from '@/lib/db';

// Regenerate at most hourly so the sitemap reflects new products/posts without
// querying the DB on every crawl.
export const revalidate = 3600;

const STATIC_PATHS: Array<[string, MetadataRoute.Sitemap[number]['changeFrequency'], number]> = [
  ['/', 'weekly', 1.0],
  ['/products', 'daily', 0.9],
  // NOTE: `/blog` is deliberately NOT here — it is appended below only when at
  // least one post is actually published. Submitting an empty index invites a
  // "Crawled – currently not indexed" verdict and burns crawl budget.
  ['/categories', 'weekly', 0.6],
  ['/about', 'monthly', 0.5],
  ['/contact', 'monthly', 0.4],
  ['/faq', 'monthly', 0.4],
  ['/shipping', 'monthly', 0.4],
  ['/gift-cards', 'monthly', 0.4],
  ['/sustainability', 'monthly', 0.3],
  ['/careers', 'monthly', 0.3],
  ['/press', 'monthly', 0.3],
  ['/privacy', 'yearly', 0.2],
  ['/terms', 'yearly', 0.2],
  ['/accessibility', 'yearly', 0.2],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = STATIC_PATHS.map(
    ([path, changeFrequency, priority]) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    }),
  );

  // Fetch dynamic entries, but never let a build-time DB hiccup fail the whole
  // build — fall back to the static routes if the DB is unavailable.
  let products: Array<{ slug: string; updatedAt: Date }> = [];
  let categories: Array<{ slug: string }> = [];
  let brands: Array<{ slug: string }> = [];
  let posts: Array<{ slug: string; publishedAt: Date | null }> = [];
  try {
    [products, categories, brands, posts] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.category.findMany({ where: { isActive: true }, select: { slug: true } }),
      prisma.brand.findMany({ where: { isActive: true }, select: { slug: true } }),
      prisma.blogPost.findMany({
        where: { isPublished: true },
        select: { slug: true, publishedAt: true },
      }),
    ]);
  } catch {
    return staticRoutes;
  }

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${base}/products/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  // "uncategorized" is the fallback bucket for products with no real category.
  // It is deliberately hidden from the storefront nav, so asking Google to
  // index it would surface a page we never link to ourselves.
  const categoryRoutes: MetadataRoute.Sitemap = categories
    .filter((c) => c.slug !== 'uncategorized')
    .map((c) => ({
      url: `${base}/categories/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

  const brandRoutes: MetadataRoute.Sitemap = brands.map((b) => ({
    url: `${base}/brands/${b.slug}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: p.publishedAt ?? now,
    changeFrequency: 'monthly',
    priority: 0.5,
  }));

  // Only advertise the blog index once it has something on it.
  const blogIndexRoute: MetadataRoute.Sitemap = postRoutes.length
    ? [{ url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 }]
    : [];

  return [
    ...staticRoutes,
    ...blogIndexRoute,
    ...productRoutes,
    ...categoryRoutes,
    ...brandRoutes,
    ...postRoutes,
  ];
}
