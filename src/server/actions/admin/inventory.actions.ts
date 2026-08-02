'use server';

import { revalidatePath } from 'next/cache';
import { StockMovementReason } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/db';

import { withAction } from '../_with-action';

import { requireAbility } from '@/server/auth/guards';
import { NotFoundError } from '@/server/http/errors';
import { inventoryService } from '@/server/services/inventory.service';
import { productsService } from '@/server/services/products.service';

/** Reasons an operator may pick by hand. Sales and receipts are posted by the
 *  system and must never be selectable, or the history stops meaning anything. */
const MANUAL_REASONS = [
  StockMovementReason.ADJUSTMENT,
  StockMovementReason.DAMAGE,
  StockMovementReason.LOSS,
  StockMovementReason.SUPPLIER_RETURN,
] as const;

const adjustBody = z.object({
  variantId: z.string().uuid(),
  /** Signed change. A count correction uses `setStockLevel` instead. */
  delta: z.coerce.number().int(),
  reason: z.enum(MANUAL_REASONS),
  note: z.string().trim().max(500).optional(),
});

/** Book a signed correction against a variant — damage, shrinkage, a find. */
export const adjustStock = withAction(async (input: z.input<typeof adjustBody>) => {
  const session = await requireAbility('inventory:adjust');
  const { variantId, delta, reason, note } = adjustBody.parse(input);

  const balance = await inventoryService.applyDelta({
    variantId,
    delta,
    reason,
    refType: 'MANUAL',
    createdBy: session.sub,
    note: note ?? null,
  });
  if (balance === null) {
    throw new NotFoundError('That would take stock below zero, or the variant is gone');
  }

  await revalidateVariant(variantId);
  return { variantId, balance };
});

const setLevelBody = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(0),
  note: z.string().trim().max(500).optional(),
});

/** Record a physical count. The difference is posted as an adjustment. */
export const setStockLevel = withAction(async (input: z.input<typeof setLevelBody>) => {
  const session = await requireAbility('inventory:adjust');
  const { variantId, quantity, note } = setLevelBody.parse(input);

  const balance = await inventoryService.setLevel({
    variantId,
    quantity,
    reason: 'ADJUSTMENT',
    refType: 'MANUAL',
    createdBy: session.sub,
    note: note ?? 'Stock count',
  });

  await revalidateVariant(variantId);
  return { variantId, balance };
});

const reorderBody = z.object({
  variantId: z.string().uuid(),
  reorderPoint: z.coerce.number().int().min(0).nullable(),
  reorderQuantity: z.coerce.number().int().min(1).nullable(),
});

/** Set (or clear) a variant's own reorder trigger and suggested order size. */
export const setReorderRule = withAction(async (input: z.input<typeof reorderBody>) => {
  await requireAbility('inventory:configure');
  const { variantId, reorderPoint, reorderQuantity } = reorderBody.parse(input);

  await prisma.productVariant.update({
    where: { id: variantId },
    data: { reorderPoint, reorderQuantity },
  });

  revalidatePath('/admin/inventory');
  return { variantId };
});

const thresholdBody = z.object({ threshold: z.coerce.number().int().min(0).max(100_000) });

/** The shop-wide fallback reorder point. */
export const setLowStockThreshold = withAction(async (input: z.input<typeof thresholdBody>) => {
  await requireAbility('inventory:configure');
  const { threshold } = thresholdBody.parse(input);

  await inventoryService.setLowStockThreshold(threshold);

  revalidatePath('/admin/inventory');
  revalidatePath('/admin');
  return { threshold };
});

/** The ledger for one variant — loaded on demand when a row is expanded. */
export const getStockHistory = withAction(async (input: { variantId: string }) => {
  await requireAbility('inventory:read');
  const variantId = z.string().uuid().parse(input.variantId);

  const movements = await inventoryService.history(variantId, 50);

  return movements.map((m) => ({
    id: m.id,
    delta: m.delta,
    balanceAfter: m.balanceAfter,
    reason: m.reason as string,
    note: m.note,
    unitCost: m.unitCost === null ? null : Number(m.unitCost),
    createdAt: m.createdAt.toISOString(),
    actor: m.actor
      ? `${m.actor.firstName ?? ''} ${m.actor.lastName ?? ''}`.trim() || m.actor.email
      : null,
  }));
});

/** Stock changes are visible on the storefront, so drop the cached PDP too. */
async function revalidateVariant(variantId: string) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { productId: true, product: { select: { slug: true } } },
  });
  if (variant) {
    await productsService.invalidate(variant.product.slug);
    revalidatePath(`/products/${variant.product.slug}`);
    revalidatePath(`/admin/products/${variant.productId}`);
  }
  revalidatePath('/admin/inventory');
}
