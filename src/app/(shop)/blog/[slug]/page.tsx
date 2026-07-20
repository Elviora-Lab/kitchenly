import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { articleJsonLd, buildMetadata, JsonLd } from '@/lib/seo';
import { formatDate } from '@/utils/format';

import { Section } from '@/design-system/primitives/section';

import { blogRepo } from '@/server/repositories/blog.repo';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await blogRepo.findPublishedBySlug(slug);
  if (!post) return buildMetadata({ title: 'Not found', path: `/blog/${slug}`, noIndex: true });
  return buildMetadata({
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.content.slice(0, 160),
    path: `/blog/${slug}`,
  });
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await blogRepo.findPublishedBySlug(slug);
  if (!post) notFound();

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
      <article className="container flex max-w-3xl flex-col gap-6">
        <Link
          href="/blog"
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          ← Home Guides
        </Link>
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
    </Section>
  );
}
