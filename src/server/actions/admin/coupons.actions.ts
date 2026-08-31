'use server';

import { revalidatePath } from 'next/cache';
import { DiscountType, Prisma } from '@prisma/client';
import { z } from 'zod';

import { parseStoreDateTimeInput } from '@/utils/time';

import { withAction } from '../_with-action';

import { requireAdmin } from '@/server/auth/guards';
import { BadRequestError } from '@/server/http/errors';
import { adminCouponsRepo } from '@/server/repositories/coupons.repo';
import { idInput, idToggleActiveInput } from '@/server/validators/admin-common.schema';

// Sanity ceiling for money fields (PKR) — a typo'd 10^9 discount should fail
// validation, not silently zero out every order.
const MAX_AMOUNT = 10_000_000;

/** Optional date string → Date, rejecting values Date.parse can't handle. */
const dateInput = z
  .string()
  .optional()
  .transform((s) => (s ? parseStoreDateTimeInput(s) : undefined))
  .refine((d) => d === undefined || !Number.isNaN(d.getTime()), { message: 'Invalid date' });

const createBody = z
  .object({
    code: z
      .string()
      .min(3)
      .max(64)
      .transform((s) => s.trim().toUpperCase()),
    discountType: z.nativeEnum(DiscountType),
    discountValue: z.coerce.number().min(0).max(MAX_AMOUNT),
    minimumOrderAmount: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
    maximumDiscount: z.coerce.number().min(0).max(MAX_AMOUNT).optional(),
    usageLimit: z.coerce.number().int().min(1).max(1_000_000).optional(),
    // Validated date strings (the form sends datetime-local values) — an
    // unparseable value fails here instead of storing "Invalid Date".
    startsAt: dateInput,
    expiresAt: dateInput,
    isActive: z.coerce.boolean().optional(),
  })
  .refine((v) => !(v.startsAt && v.expiresAt) || v.expiresAt > v.startsAt, {
    message: 'Expiry must be after the start date',
    path: ['expiresAt'],
  });

export const createCoupon = withAction(async (input: z.input<typeof createBody>) => {
  await requireAdmin();
  const data = createBody.parse(input);

  if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
    throw new BadRequestError('A percentage discount cannot exceed 100');
  }
  if (await adminCouponsRepo.findByCode(data.code)) {
    throw new BadRequestError('A coupon with that code already exists');
  }

  const coupon = await adminCouponsRepo.create({
    code: data.code,
    discountType: data.discountType,
    discountValue: new Prisma.Decimal(data.discountValue),
    minimumOrderAmount:
      data.minimumOrderAmount != null ? new Prisma.Decimal(data.minimumOrderAmount) : null,
    maximumDiscount: data.maximumDiscount != null ? new Prisma.Decimal(data.maximumDiscount) : null,
    usageLimit: data.usageLimit ?? null,
    startsAt: data.startsAt ?? null,
    expiresAt: data.expiresAt ?? null,
    isActive: data.isActive ?? true,
  });

  revalidatePath('/admin/coupons');
  return { id: coupon.id, code: coupon.code };
});

export const toggleCoupon = withAction(async (input: { id: string; isActive: boolean }) => {
  await requireAdmin();
  const { id, isActive } = idToggleActiveInput.parse(input);
  await adminCouponsRepo.setActive(id, isActive);
  revalidatePath('/admin/coupons');
  return { id: input.id, isActive: input.isActive };
});

export const deleteCoupon = withAction(async (input: { id: string }) => {
  await requireAdmin();
  const { id } = idInput.parse(input);
  await adminCouponsRepo.delete(id);
  revalidatePath('/admin/coupons');
  return { id: input.id };
});
