import { z } from 'zod';

import { prisma } from '@/lib/db';

import { createHandler } from '@/server/http/handler';
import { isSameSiteRequest } from '@/server/http/origin';
import { clientIp, isRateLimited } from '@/server/http/rate-limit';
import { apiNoContent } from '@/server/http/response';
import { logVisitorEvent } from '@/server/marketing/visitors';

export const runtime = 'nodejs';

const bodySchema = z.object({
  anonymousId: z.string().min(12).max(64),
  token: z.string().min(20).max(512).optional(),
  pagePath: z.string().max(512).nullable().optional(),
});

export const POST = createHandler(async (req) => {
  if (!isSameSiteRequest(req)) return apiNoContent();
  if (
    await isRateLimited({ key: `push-unsubscribe:${clientIp(req)}`, limit: 20, windowSeconds: 60 })
  ) {
    return apiNoContent();
  }

  const body = bodySchema.parse(await req.json());
  if (body.token) {
    await prisma.webPushToken.updateMany({
      where: { token: body.token },
      data: { isActive: false, permission: 'denied', revokedAt: new Date() },
    });
  }
  await logVisitorEvent(req, {
    anonymousId: body.anonymousId,
    eventName: 'PushUnsubscribed',
    scoreDelta: -10,
    pagePath: body.pagePath,
  });
  return apiNoContent();
});
