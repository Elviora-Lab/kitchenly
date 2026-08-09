import Link from 'next/link';

import { prisma } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';

import { Section, SectionHeading } from '@/design-system/primitives/section';
import { Button } from '@/components/ui/button';

import { GuestReviewForm, type ReviewableProduct } from './guest-review-form';

import { verifyReviewToken } from '@/server/auth/tokens';

export const metadata = buildMetadata({ title: 'Leave a review', path: '/review', noIndex: true });
export const dynamic = 'force-dynamic';

function InvalidLink({ message }: { message?: string }) {
  return (
    <Section>
      <div className="container flex max-w-xl flex-col items-start gap-6">
        <SectionHeading
          eyebrow="Reviews"
          title="This review link isn’t valid"
          description={
            message ??
            'The link may have expired or already been used. If you bought from us, check your delivery email for the latest link.'
          }
        />
        <Button asChild variant="cta" uppercase>
          <Link href="/products">Continue shopping</Link>
        </Button>
      </div>
    </Section>
  );
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) return <InvalidLink />;

  let orderId: string;
  try {
    ({ orderId } = await verifyReviewToken(token));
  } catch {
    return <InvalidLink />;
  }

  const [items, existing] = await Promise.all([
    prisma.orderItem.findMany({
      where: { orderId, productId: { not: null } },
      select: {
        productId: true,
        productName: true,
        product: {
          select: {
            images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
          },
        },
      },
    }),
    prisma.review.findMany({ where: { orderId }, select: { productId: true } }),
  ]);

  const reviewed = new Set(existing.map((r) => r.productId));
  const seen = new Set<string>();
  const products: ReviewableProduct[] = [];
  for (const it of items) {
    if (!it.productId || seen.has(it.productId)) continue;
    seen.add(it.productId);
    products.push({
      productId: it.productId,
      name: it.productName,
      imageUrl: it.product?.images[0]?.imageUrl ?? null,
      reviewed: reviewed.has(it.productId),
    });
  }

  if (products.length === 0) {
    return <InvalidLink message="This order doesn’t have any products to review." />;
  }

  return (
    <Section>
      <div className="container flex max-w-2xl flex-col gap-8">
        <SectionHeading
          eyebrow="Thank you for your order"
          title="Share your experience"
          description="Your honest review helps other shoppers — and it only takes a minute. No account needed; you’re verified as a real buyer."
        />
        <GuestReviewForm token={token} products={products} />
        <p className="text-xs text-muted-foreground">
          Reviews are checked before they appear. Thank you for keeping it genuine.
        </p>
      </div>
    </Section>
  );
}
