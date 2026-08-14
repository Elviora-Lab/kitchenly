'use server';

import { revalidatePath } from 'next/cache';
import { ReturnStatus } from '@prisma/client';
import { z } from 'zod';

import { publicEnv } from '@/config/env';

import { prisma } from '@/lib/db';

import { withAction } from '../_with-action';

import { gaTrackRefund } from '@/server/analytics/ga-measurement-protocol';
import { requireAdmin } from '@/server/auth/guards';
import { sendEmail } from '@/server/email';
import { returnUpdateEmail } from '@/server/email/templates/return-update';
import { NotFoundError } from '@/server/http/errors';
import { notifyUser } from '@/server/notifications';
import { returnsRepo } from '@/server/repositories/returns.repo';
import { transitionOrder } from '@/server/services/order-transitions.service';

const setStatusBody = z.object({
  id: z.string().uuid(),
  status: z.enum([ReturnStatus.APPROVED, ReturnStatus.REJECTED, ReturnStatus.REFUNDED]),
  adminNote: z.string().max(1000).optional(),
});

/** Admin moves a return request forward; REFUNDED also refunds the order. */
export const setReturnStatus = withAction(async (input: z.infer<typeof setStatusBody>) => {
  const session = await requireAdmin();
  const { id, status, adminNote } = setStatusBody.parse(input);

  const rr = await returnsRepo.findById(id);
  if (!rr) throw new NotFoundError('Return request not found');

  // Marking the return refunded flips the order to REFUNDED, which deducts it
  // from recognized revenue (orderStatus + paymentStatus both signal it) and
  // puts the returned units back in stock (idempotent — see transitionOrder).
  // Return status, order transition + restock, and payment status all commit
  // in ONE transaction — a return can never be REFUNDED with the order left
  // unchanged, and concurrent refund clicks can't double-apply.
  let refundApplied = false;
  if (status === 'REFUNDED') {
    refundApplied = await prisma.$transaction(async (tx) => {
      await returnsRepo.setStatus(id, status, adminNote, tx);
      const { changed } = await transitionOrder(
        rr.orderId,
        'REFUNDED',
        `Refunded via return request`,
        session.sub,
        tx,
      );
      await tx.order.update({
        where: { id: rr.orderId },
        data: { paymentStatus: 'REFUNDED' },
      });
      return changed;
    });
  } else {
    await returnsRepo.setStatus(id, status, adminNote);
  }

  // GA4 refund (server-side) — matched to the purchase by transaction_id.
  // No `_ga` cookie here (this runs in the admin's session, not the buyer's),
  // so a fallback client_id is used; GA4 still ties it to the transaction.
  // Only fired when THIS call actually performed the transition, so repeated
  // clicks can't emit duplicate refund events.
  if (refundApplied) {
    try {
      const ord = await prisma.order.findUnique({
        where: { id: rr.orderId },
        select: { totalAmount: true, currency: true },
      });
      if (ord) {
        void gaTrackRefund(
          { orderId: rr.orderId, value: Number(ord.totalAmount), currency: ord.currency },
          { userId: rr.order.userId },
        );
      }
    } catch {
      /* best-effort */
    }
  }

  // Notify + email the customer.
  await notifyAndEmail(rr.order.userId, rr.orderId, rr.order.orderNumber, status);

  revalidatePath('/admin/returns');
  revalidatePath(`/admin/orders/${rr.orderId}`);
  return { id, status };
});

async function notifyAndEmail(
  userId: string | null,
  orderId: string,
  orderNumber: string,
  status: ReturnStatus,
) {
  if (!userId) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  await notifyUser({
    userId,
    type: 'ORDER_UPDATE',
    title: `Return ${status.toLowerCase()}`,
    message: `Your return for order ${orderNumber} is now ${status.toLowerCase()}.`,
  });
  if (user?.email) {
    const { subject, html, text } = returnUpdateEmail({
      orderNumber,
      orderUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/checkout/success/${orderId}`,
      status,
    });
    await sendEmail({ to: user.email, subject, html, text });
  }
}
