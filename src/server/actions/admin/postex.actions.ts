'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { withAction } from '../_with-action';

import { requireAdmin } from '@/server/auth/guards';
import {
  bulkTrackPostExOrders,
  cancelPostExOrder,
  createPostExPickupAddress,
  getPostExPaymentStatus,
  getPostExShipperAdvice,
  getPostExTrackingDetail,
  listPostExOrders,
  listPostExUnbookedOrders,
  savePostExShipperAdvice,
} from '@/server/shipping/postex';

const trackingNumber = z.string().trim().min(3).max(120);
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const trackingList = z
  .string()
  .min(3)
  .transform((value) =>
    value
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean),
  )
  .refine((items) => items.length > 0, 'Add at least one tracking number');

export const lookupPostExTracking = withAction(async (input: { trackingNumber: string }) => {
  await requireAdmin();
  const parsed = z.object({ trackingNumber }).parse(input);
  return getPostExTrackingDetail(parsed.trackingNumber);
});

export const lookupPostExPayment = withAction(async (input: { trackingNumber: string }) => {
  await requireAdmin();
  const parsed = z.object({ trackingNumber }).parse(input);
  return getPostExPaymentStatus(parsed.trackingNumber);
});

export const lookupPostExAdvice = withAction(async (input: { trackingNumber: string }) => {
  await requireAdmin();
  const parsed = z.object({ trackingNumber }).parse(input);
  return getPostExShipperAdvice(parsed.trackingNumber);
});

export const bulkLookupPostExTracking = withAction(async (input: { trackingNumbers: string }) => {
  await requireAdmin();
  const parsed = z.object({ trackingNumbers: trackingList }).parse(input);
  return bulkTrackPostExOrders(parsed.trackingNumbers);
});

export const searchPostExOrders = withAction(
  async (input: { orderStatusID: number; fromDate: string; toDate: string }) => {
    await requireAdmin();
    const parsed = z
      .object({
        orderStatusID: z.coerce.number().int().min(0).max(999),
        fromDate: dateText,
        toDate: dateText,
      })
      .parse(input);
    return listPostExOrders(parsed);
  },
);

export const searchPostExUnbookedOrders = withAction(
  async (input: { startDate: string; endDate: string; cityName?: string }) => {
    await requireAdmin();
    const parsed = z
      .object({
        startDate: dateText,
        endDate: dateText,
        cityName: z.string().trim().max(120).optional(),
      })
      .parse(input);
    return listPostExUnbookedOrders(parsed);
  },
);

export const addPostExPickupAddress = withAction(
  async (input: {
    address: string;
    addressTypeId: 1 | 2;
    cityName: string;
    contactPersonName: string;
    phone1: string;
    phone2: string;
    phone3?: string;
    wareHouseManagerName?: string;
  }) => {
    await requireAdmin();
    const parsed = z
      .object({
        address: z.string().trim().min(5).max(255),
        addressTypeId: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2)])),
        cityName: z.string().trim().min(2).max(120),
        contactPersonName: z.string().trim().min(2).max(160),
        phone1: z.string().trim().min(8).max(32),
        phone2: z.string().trim().min(8).max(32),
        phone3: z.string().trim().max(32).optional(),
        wareHouseManagerName: z.string().trim().max(160).optional(),
      })
      .parse(input);
    const result = await createPostExPickupAddress(parsed);
    revalidatePath('/admin/postex');
    return result;
  },
);

export const submitPostExShipperAdvice = withAction(
  async (input: { trackingNumber: string; statusId: 1 | 2; remarks: string }) => {
    await requireAdmin();
    const parsed = z
      .object({
        trackingNumber,
        statusId: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2)])),
        remarks: z.string().trim().min(2).max(500),
      })
      .parse(input);
    await savePostExShipperAdvice(parsed);
    return { ok: true };
  },
);

export const cancelPostExByTracking = withAction(async (input: { trackingNumber: string }) => {
  await requireAdmin();
  const parsed = z.object({ trackingNumber }).parse(input);
  await cancelPostExOrder(parsed.trackingNumber);
  return { ok: true };
});
