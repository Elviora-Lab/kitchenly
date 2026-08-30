import { NextResponse } from 'next/server';
import { z } from 'zod';

import { publicEnv } from '@/config/env';

import { prisma } from '@/lib/db';

import { sendCapiEvent } from '@/server/analytics/meta-capi';
import { requestMatchData } from '@/server/marketing/visitors';

export const runtime = 'nodejs';

const querySchema = z.object({
  v: z.string().uuid(),
  kind: z.string().min(1).max(64).default('push_click'),
  to: z.string().min(1).max(512).default('/'),
});

function safePath(to: string): string {
  if (!to.startsWith('/')) return '/';
  if (to.startsWith('//')) return '/';
  return to;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    v: url.searchParams.get('v'),
    kind: url.searchParams.get('kind') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
  });
  if (!parsed.success) return NextResponse.redirect(new URL('/', publicEnv.NEXT_PUBLIC_SITE_URL));

  const target = safePath(parsed.data.to);
  const visitor = await prisma.marketingVisitor.findUnique({
    where: { id: parsed.data.v },
    select: { id: true, anonymousId: true, guestId: true, fbp: true, fbc: true },
  });

  if (visitor) {
    await prisma.visitorEventLog
      .create({
        data: {
          visitorId: visitor.id,
          guestId: visitor.guestId,
          eventName: 'CartRecoveryClick',
          scoreDelta: 18,
          pagePath: target,
          metadata: { kind: parsed.data.kind },
        },
      })
      .catch(() => undefined);

    const match = await requestMatchData();
    await sendCapiEvent({
      eventName: 'CartRecoveryClick',
      eventId: `push-click-${visitor.id}-${Date.now()}`,
      eventSourceUrl: new URL(target, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
      userData: {
        externalId: visitor.guestId ?? visitor.anonymousId,
        fbp: match.fbp ?? visitor.fbp,
        fbc: match.fbc ?? visitor.fbc,
        clientIp: match.clientIp,
        userAgent: match.userAgent,
      },
      customData: { content_name: parsed.data.kind },
    });
  }

  return NextResponse.redirect(new URL(target, publicEnv.NEXT_PUBLIC_SITE_URL));
}
