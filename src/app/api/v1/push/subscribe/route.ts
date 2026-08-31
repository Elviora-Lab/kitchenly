import { z } from 'zod';

import { prisma } from '@/lib/db';

import { capiEnabled, sendCapiEvent } from '@/server/analytics/meta-capi';
import { getSession } from '@/server/auth/get-session';
import { createHandler } from '@/server/http/handler';
import { isSameSiteRequest } from '@/server/http/origin';
import { clientIp, isRateLimited } from '@/server/http/rate-limit';
import { apiNoContent, apiSuccess } from '@/server/http/response';
import { requestMatchData, upsertMarketingVisitor } from '@/server/marketing/visitors';

export const runtime = 'nodejs';

const bodySchema = z.object({
  anonymousId: z.string().min(12).max(64),
  token: z.string().min(80).max(2048),
  firebaseInstallationId: z.string().max(128).nullable().optional(),
  permission: z.enum(['granted']),
  platform: z.string().max(64).nullable().optional(),
  pagePath: z.string().max(512).nullable().optional(),
  fbp: z.string().max(255).nullable().optional(),
  fbc: z.string().max(255).nullable().optional(),
  utm: z
    .object({
      source: z.string().max(120).nullable().optional(),
      medium: z.string().max(120).nullable().optional(),
      campaign: z.string().max(160).nullable().optional(),
      content: z.string().max(160).nullable().optional(),
      term: z.string().max(160).nullable().optional(),
    })
    .optional(),
});

export const POST = createHandler(async (req) => {
  if (!isSameSiteRequest(req)) return apiNoContent();
  if (
    await isRateLimited({ key: `push-subscribe:${clientIp(req)}`, limit: 20, windowSeconds: 60 })
  ) {
    return apiNoContent();
  }

  const body = bodySchema.parse(await req.json());
  const visitor = await upsertMarketingVisitor(req, {
    anonymousId: body.anonymousId,
    fbp: body.fbp,
    fbc: body.fbc,
    utm: body.utm,
    lastPath: body.pagePath,
    notificationPermission: body.permission,
  });

  const userAgent = req.headers.get('user-agent')?.slice(0, 512) ?? null;

  await prisma.$transaction([
    prisma.webPushToken.upsert({
      where: { token: body.token },
      create: {
        visitorId: visitor.id,
        token: body.token,
        firebaseInstallationId: body.firebaseInstallationId ?? null,
        permission: body.permission,
        platform: body.platform ?? null,
        userAgent,
      },
      update: {
        visitorId: visitor.id,
        firebaseInstallationId: body.firebaseInstallationId ?? null,
        permission: body.permission,
        platform: body.platform ?? null,
        userAgent,
        isActive: true,
        revokedAt: null,
        lastSeenAt: new Date(),
      },
    }),
    prisma.marketingVisitor.update({
      where: { id: visitor.id },
      data: {
        notificationPermission: body.permission,
        pushSubscribedAt: visitor.pushSubscribedAt ?? new Date(),
        intentScore: { increment: 20 },
      },
    }),
    prisma.visitorEventLog.create({
      data: {
        visitorId: visitor.id,
        guestId: visitor.guestId,
        eventName: 'PushSubscribed',
        cartId: visitor.cartId,
        scoreDelta: 20,
        pagePath: body.pagePath ?? null,
        metadata: { platform: body.platform ?? null },
      },
    }),
  ]);

  if (capiEnabled()) {
    const [session, match] = await Promise.all([getSession(req), requestMatchData()]);
    await sendCapiEvent({
      eventName: 'PushSubscribed',
      eventId: `push-${visitor.id}-${Date.now()}`,
      eventSourceUrl: new URL(body.pagePath ?? '/', req.url).toString(),
      userData: {
        email: session?.email ?? null,
        externalId: session?.sub ?? visitor.guestId ?? visitor.anonymousId,
        ...match,
      },
      customData: { content_name: 'web_push_subscription', status: 'granted' },
    });
  }

  return apiSuccess({ visitorId: visitor.id, subscribed: true });
});
