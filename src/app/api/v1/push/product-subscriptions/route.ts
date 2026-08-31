import { z } from 'zod';

import { prisma } from '@/lib/db';

import { BadRequestError } from '@/server/http/errors';
import { createHandler } from '@/server/http/handler';
import { isSameSiteRequest } from '@/server/http/origin';
import { clientIp, isRateLimited } from '@/server/http/rate-limit';
import { apiNoContent, apiSuccess } from '@/server/http/response';
import { logVisitorEvent, upsertMarketingVisitor } from '@/server/marketing/visitors';

export const runtime = 'nodejs';

const bodySchema = z.object({
  anonymousId: z.string().min(12).max(64),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  type: z.enum(['PRICE_DROP', 'BACK_IN_STOCK', 'DEAL']),
  pagePath: z.string().max(512).nullable().optional(),
});

export const POST = createHandler(async (req) => {
  if (!isSameSiteRequest(req)) return apiNoContent();
  if (
    await isRateLimited({ key: `product-push-sub:${clientIp(req)}`, limit: 30, windowSeconds: 60 })
  ) {
    return apiNoContent();
  }

  const body = bodySchema.parse(await req.json());
  const visitor = await upsertMarketingVisitor(req, {
    anonymousId: body.anonymousId,
    lastPath: body.pagePath,
    notificationPermission:
      body.type === 'PRICE_DROP' || body.type === 'BACK_IN_STOCK' || body.type === 'DEAL'
        ? 'granted'
        : 'default',
  });

  const activeTokenCount = await prisma.webPushToken.count({
    where: { visitorId: visitor.id, isActive: true },
  });
  if (activeTokenCount === 0) {
    throw new BadRequestError('Enable browser notifications before saving this alert');
  }

  const existing = await prisma.productNotificationSubscription.findFirst({
    where: {
      visitorId: visitor.id,
      productId: body.productId,
      variantId: body.variantId ?? null,
      type: body.type,
    },
  });
  const subscription = existing
    ? await prisma.productNotificationSubscription.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', endedAt: null },
      })
    : await prisma.productNotificationSubscription.create({
        data: {
          visitorId: visitor.id,
          productId: body.productId,
          variantId: body.variantId ?? null,
          type: body.type,
        },
      });

  await logVisitorEvent(req, {
    anonymousId: body.anonymousId,
    eventName: `${body.type}PushSubscribed`,
    productId: body.productId,
    variantId: body.variantId ?? null,
    scoreDelta: 10,
    pagePath: body.pagePath,
  });

  return apiSuccess({ id: subscription.id, subscribed: true });
});
