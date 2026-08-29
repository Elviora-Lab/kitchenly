'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';

import { withAction } from '../_with-action';

import { requireAdmin } from '@/server/auth/guards';
import { promotionsService } from '@/server/services/promotions.service';
import { idInput, idToggleActiveInput } from '@/server/validators/admin-common.schema';

function revalidateSpendDiscountSurfaces() {
  revalidatePath('/admin/coupons');
  revalidatePath('/');
  revalidatePath('/cart');
  revalidatePath('/checkout');
  revalidatePath('/api/v1/promotions/spend-tiers');
}

const tierBody = z
  .object({
    minSubtotal: z.coerce.number().positive().max(10_000_000),
    discountAmount: z.coerce.number().positive().max(10_000_000),
  })
  .refine((v) => v.discountAmount < v.minSubtotal, {
    message: 'Discount must be less than the spend threshold',
    path: ['discountAmount'],
  });

/** Add a Spend & Save tier. */
export const createSpendTier = withAction(async (input: z.infer<typeof tierBody>) => {
  await requireAdmin();
  const { minSubtotal, discountAmount } = tierBody.parse(input);
  await prisma.spendDiscountTier.create({ data: { minSubtotal, discountAmount } });
  await promotionsService.invalidateDisplay();
  revalidateSpendDiscountSurfaces();
  return { ok: true };
});

/** Activate / deactivate a single tier. */
export const toggleSpendTier = withAction(async (input: { id: string; isActive: boolean }) => {
  await requireAdmin();
  const { id, isActive } = idToggleActiveInput.parse(input);
  await prisma.spendDiscountTier.update({
    where: { id },
    data: { isActive },
  });
  await promotionsService.invalidateDisplay();
  revalidateSpendDiscountSurfaces();
  return { ok: true };
});

/** Delete a tier. */
export const deleteSpendTier = withAction(async (input: { id: string }) => {
  await requireAdmin();
  const { id } = idInput.parse(input);
  await prisma.spendDiscountTier.delete({ where: { id } });
  await promotionsService.invalidateDisplay();
  revalidateSpendDiscountSurfaces();
  return { ok: true };
});

/** Master switch for the whole Spend & Save feature. */
export const setSpendDiscountEnabled = withAction(async (input: { enabled: boolean }) => {
  await requireAdmin();
  await promotionsService.setEnabled(Boolean(input.enabled));
  await promotionsService.invalidateDisplay();
  revalidateSpendDiscountSurfaces();
  return { ok: true };
});
