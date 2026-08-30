import { type Prisma } from '@prisma/client';
import { z } from 'zod';

import { createHandler } from '@/server/http/handler';
import { isSameSiteRequest } from '@/server/http/origin';
import { clientIp, isRateLimited } from '@/server/http/rate-limit';
import { apiNoContent } from '@/server/http/response';
import { logVisitorEvent } from '@/server/marketing/visitors';

export const runtime = 'nodejs';

const bodySchema = z.object({
  anonymousId: z.string().min(12).max(64),
  eventName: z.string().min(1).max(64),
  productId: z.string().uuid().nullable().optional(),
  variantId: z.string().uuid().nullable().optional(),
  cartId: z.string().uuid().nullable().optional(),
  value: z.number().finite().min(0).max(10_000_000).nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  scoreDelta: z.number().int().min(-100).max(100).optional(),
  pagePath: z.string().max(512).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const POST = createHandler(async (req) => {
  if (!isSameSiteRequest(req)) return apiNoContent();
  if (
    await isRateLimited({ key: `visitor-event:${clientIp(req)}`, limit: 120, windowSeconds: 60 })
  ) {
    return apiNoContent();
  }

  const body = bodySchema.parse(await req.json());
  await logVisitorEvent(req, {
    ...body,
    metadata: body.metadata as Prisma.InputJsonValue | undefined,
  });
  return apiNoContent();
});
