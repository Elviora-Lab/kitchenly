import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

/**
 * Crawl rules.
 *
 * Deliberately permissive: everything needed to RENDER a page — `/_next/`
 * chunks, CSS, JS, images — stays crawlable, because Googlebot renders the
 * page before judging it and a blocked stylesheet reads as a broken layout.
 *
 * Disallow is reserved for URLs with no search value at all: the admin,
 * transactional funnel, JSON APIs, and internal search. Note that `Disallow`
 * blocks CRAWLING, not indexing — a blocked URL can still be indexed from an
 * external link, with no snippet. Pages that must genuinely stay out of the
 * index (the single-brand listing, thin categories, the legacy quiz route)
 * therefore carry a `noindex` meta tag instead of an entry here, since Google
 * has to be able to fetch a page to see that tag.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/account',
          '/checkout',
          '/cart',
          '/api',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          // Internal search results: infinite, thin, and competing with the
          // curated category pages we actually want ranked.
          '/search',
          // Single-use, token-gated review links.
          '/review',
          // Admin-only draft preview of an unpublished PDP.
          '/products/*/preview',
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
