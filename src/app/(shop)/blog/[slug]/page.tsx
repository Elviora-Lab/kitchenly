import { cache } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { categorySeo, categorySlugsForGuide } from '@/config/category-seo';
import { routes } from '@/config/routes';

import {
  articleJsonLd,
  breadcrumbJsonLd,
  buildMetadata,
  generateArticleMetadata,
  JsonLd,
} from '@/lib/seo';
import { formatDate } from '@/utils/format';

import { ProductCard } from '@/design-system/patterns/product-card';
import { Breadcrumb } from '@/design-system/primitives/breadcrumb';
import { Section } from '@/design-system/primitives/section';
import { Button } from '@/components/ui/button';

import { blogRepo } from '@/server/repositories/blog.repo';
import { categoriesService } from '@/server/services/categories.service';
import { productsService } from '@/server/services/products.service';

type Params = Promise<{ slug: string }>;

// generateMetadata and the page body both need the post — React cache()
// collapses them into one query per request.
const getPost = cache((slug: string) => blogRepo.findPublishedBySlug(slug));

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return buildMetadata({ title: 'Not found', path: `/blog/${slug}`, noIndex: true });
  return generateArticleMetadata({
    slug,
    title: post.title,
    seoTitle: post.seoTitle,
    seoDescription: post.seoDescription,
    content: post.content,
    image: post.thumbnail,
  });
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  // A guide that does not route anywhere is just content. These links are the
  // whole point of the blog: informational query → article → the category and
  // products that answer it commercially. The mapping is derived from
  // `CATEGORY_SEO.guides`, so it is impossible for a category to link to a
  // guide that does not link back.
  const linkedSlugs = categorySlugsForGuide(slug);
  const [allCategories, picks] = await Promise.all([
    categoriesService.list().catch(() => []),
    linkedSlugs[0]
      ? productsService
          .list({ category: linkedSlugs[0] }, 'popular', 1, 4)
          .then((r) => r.items)
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const linkedCategories = linkedSlugs
    .map((s) => allCategories.find((c) => c.slug === s))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => ({ name: categorySeo(c.slug)?.h1 ?? c.name, slug: c.slug }));

  const crumbs = [
    { label: 'Home', href: '/' },
    { label: 'Home Guides', href: '/blog' },
  ];

  return (
    <Section>
      <JsonLd
        data={articleJsonLd({
          title: post.title,
          description: post.seoDescription ?? post.content.slice(0, 160),
          slug,
          image: post.thumbnail,
          publishedAt: post.publishedAt,
        })}
      />
      <JsonLd data={breadcrumbJsonLd([...crumbs, { label: post.title, href: `/blog/${slug}` }])} />

      <div className="container flex flex-col gap-12">
        <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          <Breadcrumb items={[...crumbs, { label: post.title }]} />
          <header className="flex flex-col gap-2">
            {post.publishedAt ? (
              <span className="eyebrow">{formatDate(post.publishedAt, { dateStyle: 'long' })}</span>
            ) : null}
            <h1 className="editorial-heading text-display-md md:text-display-lg">{post.title}</h1>
          </header>
          <div className="whitespace-pre-line text-pretty leading-relaxed text-muted-foreground">
            {post.content}
          </div>
        </article>

        {linkedCategories.length > 0 ? (
          <aside className="mx-auto flex w-full max-w-3xl flex-col gap-4 rounded-xl border border-border bg-card p-6">
            <h2 className="editorial-heading text-display-sm">Shop this guide</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Everything mentioned above lives in these categories.
            </p>
            <div className="flex flex-wrap gap-3">
              {linkedCategories.map((cat) => (
                <Button key={cat.slug} asChild variant="outline" size="sm">
                  <Link href={routes.category(cat.slug)}>{cat.name}</Link>
                </Button>
              ))}
            </div>
          </aside>
        ) : null}

        {picks.length > 0 ? (
          <section className="flex flex-col gap-6">
            <header className="flex flex-col gap-1">
              <span className="eyebrow">Popular right now</span>
              <h2 className="editorial-heading text-display-sm">Picks that fit this guide</h2>
            </header>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
              {picks.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  listId={`blog_${slug}`}
                  listName={post.title}
                  index={i}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="mx-auto w-full max-w-3xl">
          <Link
            href="/blog"
            className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
          >
            ← All home guides
          </Link>
        </div>
      </div>
    </Section>
  );
}
