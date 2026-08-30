import 'server-only';

import { publicEnv } from '@/config/env';

import { prisma } from '@/lib/db';

import { fcmEnabled, sendFcmPush } from '@/server/marketing/fcm';

function productUrl(slug: string, visitorId: string): string {
  const to = encodeURIComponent(`/products/${slug}`);
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/v1/push/click?kind=back_in_stock&v=${visitorId}&to=${to}`;
}

/**
 * Deliver browser pushes for active BACK_IN_STOCK subscriptions once the
 * product/variant has stock again, then end the subscription so it fires once.
 */
export const productPushService = {
  async sweepBackInStock(now: Date = new Date()) {
    if (!fcmEnabled()) return { scanned: 0, sent: 0, skipped: 'FCM is not configured' };

    const subscriptions = await prisma.productNotificationSubscription.findMany({
      where: { status: 'ACTIVE', type: 'BACK_IN_STOCK' },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    let scanned = 0;
    let sent = 0;

    for (const sub of subscriptions) {
      scanned += 1;

      const product = await prisma.product.findUnique({
        where: { id: sub.productId },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { imageUrl: true },
          },
          variants: {
            where: sub.variantId
              ? { id: sub.variantId, isActive: true }
              : { isActive: true, stockQuantity: { gt: 0 } },
            select: { id: true, stockQuantity: true },
            take: 5,
          },
        },
      });

      if (!product?.isActive) continue;

      const inStock = sub.variantId
        ? (product.variants[0]?.stockQuantity ?? 0) > 0
        : product.variants.some((v) => v.stockQuantity > 0);
      if (!inStock) continue;

      const tokens = await prisma.webPushToken.findMany({
        where: { visitorId: sub.visitorId, isActive: true },
        orderBy: { lastSeenAt: 'desc' },
        take: 2,
      });
      if (tokens.length === 0) continue;

      // Claim before send so overlapping crons can't double-notify.
      const { count } = await prisma.productNotificationSubscription.updateMany({
        where: { id: sub.id, status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: now },
      });
      if (count === 0) continue;

      const delivered = await sendFcmPush({
        token: tokens[0]!.token,
        title: 'Back in stock',
        body: `${product.name} is available again — grab it before it goes.`,
        url: productUrl(product.slug, sub.visitorId),
        icon: product.images[0]?.imageUrl,
        data: {
          kind: 'back_in_stock',
          product_id: product.id,
        },
      });

      await prisma.visitorEventLog.create({
        data: {
          visitorId: sub.visitorId,
          eventName: delivered ? 'BackInStockPushSent' : 'BackInStockPushFailed',
          productId: product.id,
          variantId: sub.variantId,
          scoreDelta: delivered ? 5 : 0,
          metadata: { subscriptionId: sub.id, sentAt: now.toISOString() },
        },
      });

      if (delivered) {
        sent += 1;
      } else {
        // Release so a later sweep can retry.
        await prisma.productNotificationSubscription
          .updateMany({
            where: { id: sub.id },
            data: { status: 'ACTIVE', endedAt: null },
          })
          .catch(() => undefined);
      }
    }

    return { scanned, sent };
  },
};
