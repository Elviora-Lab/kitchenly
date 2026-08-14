'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { publicEnv } from '@/config/env';

import { prisma } from '@/lib/db';

import { withAction } from './_with-action';

import { requireUser } from '@/server/auth/guards';
import { sendEmail } from '@/server/email';
import { returnUpdateEmail } from '@/server/email/templates/return-update';
import { BadRequestError, NotFoundError } from '@/server/http/errors';
import { notifyUser } from '@/server/notifications';
import { returnsRepo } from '@/server/repositories/returns.repo';

export const RETURN_REASONS = [
  'Damaged or defective',
  'Wrong item received',
  'Not as described',
  'Changed my mind',
  'Other',
] as const;

const requestReturnBody = z.object({
  orderId: z.string().uuid(),
  reason: z.enum(RETURN_REASONS),
  comment: z.string().max(1000).optional(),
});

/** Customer requests a return for one of their delivered orders. */
export const requestReturn = withAction(async (input: z.infer<typeof requestReturnBody>) => {
  const session = await requireUser();
  const { orderId, reason, comment } = requestReturnBody.parse(input);

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: session.sub },
    select: { id: true, orderStatus: true, orderNumber: true, user: { select: { email: true } } },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.orderStatus !== 'DELIVERED') {
    throw new BadRequestError('Returns can only be requested for delivered orders');
  }
  if (await returnsRepo.findByOrder(orderId)) {
    throw new BadRequestError('A return request already exists for this order');
  }

  // The pre-check above is for a friendly message only — the unique constraint
  // on orderId is the real guard. Two concurrent submissions race past the
  // check; the loser hits P2002, which we surface as the same message.
  let created: Awaited<ReturnType<typeof returnsRepo.create>>;
  try {
    created = await returnsRepo.create({ orderId, userId: session.sub, reason, comment });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new BadRequestError('A return request already exists for this order');
    }
    throw err;
  }

  await notifyUser({
    userId: session.sub,
    type: 'ORDER_UPDATE',
    title: 'Return request received',
    message: `We received your return request for order ${order.orderNumber}.`,
  });
  if (order.user?.email) {
    const { subject, html, text } = returnUpdateEmail({
      orderNumber: order.orderNumber,
      orderUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/checkout/success/${orderId}`,
      status: 'REQUESTED',
    });
    await sendEmail({ to: order.user.email, subject, html, text });
  }

  revalidatePath(`/account/orders/${orderId}`);
  return { id: created.id, status: created.status };
});
