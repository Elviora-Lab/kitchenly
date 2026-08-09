import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { type CategorySeo } from '@/config/category-seo';
import { routes } from '@/config/routes';

/**
 * Bottom-of-page content for a category: the buying-guide prose that answers
 * what the listing itself cannot, followed by sideways links to sibling
 * categories and down-links to the guides that support the same cluster.
 *
 * Placed BELOW the product grid on purpose. Shoppers came to see products, so
 * products come first; the copy is there for the visitor still deciding and
 * for the crawler working out what this URL is about. The related links are
 * the whole internal-linking strategy for categories — they add crawl paths
 * and discovery routes without adding a level to the customer-facing menu.
 */
export function CategorySeoBlock({
  seo,
  relatedCategories,
  guides,
}: {
  seo: CategorySeo;
  relatedCategories: { name: string; slug: string }[];
  guides: { title: string; slug: string }[];
}) {
  return (
    <section className="flex flex-col gap-10 border-t border-border/60 pt-10">
      <div className="grid gap-8 md:grid-cols-3">
        {seo.body.map((section) => (
          <div key={section.heading} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold text-foreground">{section.heading}</h2>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              {section.text}
            </p>
          </div>
        ))}
      </div>

      {relatedCategories.length > 0 || guides.length > 0 ? (
        <div className="grid gap-8 sm:grid-cols-2">
          {relatedCategories.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h2 className="eyebrow">Related categories</h2>
              <ul className="flex flex-wrap gap-2">
                {relatedCategories.map((cat) => (
                  <li key={cat.slug}>
                    <Link
                      href={routes.category(cat.slug)}
                      className="inline-flex min-h-10 items-center rounded-full border border-border px-4 py-2 text-sm text-foreground/75 transition-colors hover:border-foreground/40 hover:text-foreground"
                    >
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {guides.length > 0 ? (
            <div className="flex flex-col gap-3">
              <h2 className="eyebrow">Guides that help you choose</h2>
              <ul className="flex flex-col gap-2">
                {guides.map((guide) => (
                  <li key={guide.slug}>
                    <Link
                      href={routes.blogPost(guide.slug)}
                      className="group inline-flex items-start gap-2 text-sm text-foreground/80 transition-colors hover:text-foreground"
                    >
                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-accent" />
                      <span className="underline-offset-4 group-hover:underline">
                        {guide.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
