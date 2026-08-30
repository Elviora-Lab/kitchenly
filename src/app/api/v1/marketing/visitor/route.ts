import { z } from 'zod';

import { createHandler } from '@/server/http/handler';
import { isSameSiteRequest } from '@/server/http/origin';
import { clientIp, isRateLimited } from '@/server/http/rate-limit';
import { apiNoContent, apiSuccess } from '@/server/http/response';
import { upsertMarketingVisitor } from '@/server/marketing/visitors';

export const runtime = 'nodejs';

const bodySchema = z.object({
  anonymousId: z.string().min(12).max(64),
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
  firstPath: z.string().max(512).nullable().optional(),
  lastPath: z.string().max(512).nullable().optional(),
  referrer: z.string().max(512).nullable().optional(),
  deviceType: z.string().max(32).nullable().optional(),
  notificationPermission: z.enum(['default', 'granted', 'denied']).nullable().optional(),
});

export const POST = createHandler(async (req) => {
  if (!isSameSiteRequest(req)) return apiNoContent();
  if (await isRateLimited({ key: `visitor:${clientIp(req)}`, limit: 60, windowSeconds: 60 })) {
    return apiNoContent();
  }

  const body = bodySchema.parse(await req.json());
  const visitor = await upsertMarketingVisitor(req, body);
  return apiSuccess({
    visitorId: visitor.id,
    intentScore: visitor.intentScore,
    pushSubscribed: Boolean(visitor.pushSubscribedAt),
  });
});
