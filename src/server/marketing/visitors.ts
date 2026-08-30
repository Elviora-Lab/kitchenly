import 'server-only';

import { cookies, headers } from 'next/headers';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

import { getSession } from '@/server/auth/get-session';
import { getOrCreateGuestId } from '@/server/auth/guest-session';

const UTM_COOKIE = 'elv_utm';

type VisitorUtm = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
};

export type VisitorIdentityInput = {
  anonymousId: string;
  fbp?: string | null;
  fbc?: string | null;
  utm?: VisitorUtm;
  firstPath?: string | null;
  lastPath?: string | null;
  referrer?: string | null;
  deviceType?: string | null;
  notificationPermission?: string | null;
};

export type VisitorEventInput = {
  anonymousId: string;
  eventName: string;
  productId?: string | null;
  variantId?: string | null;
  cartId?: string | null;
  value?: number | null;
  currency?: string | null;
  scoreDelta?: number;
  pagePath?: string | null;
  metadata?: Prisma.InputJsonValue;
};

function trim(value: string | null | undefined, max: number): string | null {
  const out = value?.trim();
  if (!out) return null;
  return out.slice(0, max);
}

function parseUtmCookie(value: string | undefined): VisitorUtm {
  if (!value) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as {
      s?: string;
      m?: string;
      c?: string;
      content?: string;
      term?: string;
    };
    return {
      source: parsed.s,
      medium: parsed.m,
      campaign: parsed.c,
      content: parsed.content,
      term: parsed.term,
    };
  } catch {
    return {};
  }
}

function mergeUtm(input: VisitorUtm | undefined, cookieValue: string | undefined): VisitorUtm {
  const fromCookie = parseUtmCookie(cookieValue);
  return {
    source: input?.source ?? fromCookie.source ?? null,
    medium: input?.medium ?? fromCookie.medium ?? null,
    campaign: input?.campaign ?? fromCookie.campaign ?? null,
    content: input?.content ?? fromCookie.content ?? null,
    term: input?.term ?? fromCookie.term ?? null,
  };
}

export async function upsertMarketingVisitor(req: Request, input: VisitorIdentityInput) {
  const [session, guestId, cookieStore] = await Promise.all([
    getSession(req),
    getOrCreateGuestId(),
    cookies(),
  ]);

  const utm = mergeUtm(input.utm, cookieStore.get(UTM_COOKIE)?.value);
  const existing = await prisma.marketingVisitor.findFirst({
    where: {
      OR: [{ anonymousId: input.anonymousId }, { guestId }],
    },
    select: { id: true, firstPath: true },
  });

  const cart = await prisma.cart.findFirst({
    where: session?.sub
      ? { OR: [{ userId: session.sub }, { sessionId: guestId }] }
      : { sessionId: guestId },
    select: { id: true },
  });

  const data = {
    anonymousId: input.anonymousId,
    guestId,
    userId: session?.sub ?? null,
    cartId: cart?.id ?? null,
    fbp: trim(input.fbp ?? cookieStore.get('_fbp')?.value, 255),
    fbc: trim(input.fbc ?? cookieStore.get('_fbc')?.value, 255),
    utmSource: trim(utm.source, 120),
    utmMedium: trim(utm.medium, 120),
    utmCampaign: trim(utm.campaign, 160),
    utmContent: trim(utm.content, 160),
    utmTerm: trim(utm.term, 160),
    firstPath: existing?.firstPath ?? trim(input.firstPath, 512),
    lastPath: trim(input.lastPath, 512),
    referrer: trim(input.referrer, 512),
    deviceType: trim(input.deviceType, 32),
    notificationPermission: trim(input.notificationPermission, 16) ?? 'default',
    lastSeenAt: new Date(),
  };

  if (existing) {
    return prisma.marketingVisitor.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.marketingVisitor.create({ data });
}

export async function logVisitorEvent(req: Request, input: VisitorEventInput) {
  const visitor = await upsertMarketingVisitor(req, {
    anonymousId: input.anonymousId,
    lastPath: input.pagePath,
  });
  const guestId = (await cookies()).get('elv_guest')?.value ?? visitor.guestId;
  const scoreDelta = input.scoreDelta ?? 0;

  await prisma.$transaction([
    prisma.visitorEventLog.create({
      data: {
        visitorId: visitor.id,
        guestId,
        eventName: input.eventName,
        productId: input.productId ?? null,
        variantId: input.variantId ?? null,
        cartId: input.cartId ?? visitor.cartId ?? null,
        value: input.value ?? null,
        currency: trim(input.currency, 3),
        scoreDelta,
        pagePath: trim(input.pagePath, 512),
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    }),
    ...(scoreDelta !== 0
      ? [
          prisma.marketingVisitor.update({
            where: { id: visitor.id },
            data: { intentScore: { increment: scoreDelta }, lastSeenAt: new Date() },
          }),
        ]
      : []),
  ]);

  return visitor;
}

export async function requestMatchData() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return {
    clientIp: headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: headerStore.get('user-agent'),
    fbp: cookieStore.get('_fbp')?.value ?? null,
    fbc: cookieStore.get('_fbc')?.value ?? null,
  };
}
