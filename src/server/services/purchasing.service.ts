import 'server-only';

import { type Prisma } from '@prisma/client';
import { customAlphabet } from 'nanoid';

import { prisma } from '@/lib/db';
import {
  dec,
  extraCharges,
  landedCostFactor,
  movingAverageCost,
  orderedValue,
  statusAfterReceipt,
  unitLandedCost,
} from '@/lib/purchasing';
import { storeYear } from '@/utils/time';

import { BadRequestError, ConflictError, NotFoundError } from '@/server/http/errors';
import { inventoryService } from '@/server/services/inventory.service';

const poNumberAlphabet = customAlphabet('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 6);
const newPoNumber = () => `PO-${storeYear()}-${poNumberAlphabet()}`;

/** Statuses that still accept a delivery. */
const RECEIVABLE = new Set<Prisma.PurchaseOrderCreateInput['status']>([
  'SUBMITTED',
  'PARTIALLY_RECEIVED',
]);

export type PurchaseOrderLineInput = {
  variantId: string;
  quantityOrdered: number;
  unitCost: number;
};

export type ReceiptLineInput = {
  purchaseOrderItemId: string;
  quantity: number;
};

export const purchasingService = {
  /**
   * Open a draft purchase order. Drafts are the only editable state — once
   * submitted, a PO is the record of what was ordered and only receiving
   * changes it.
   */
  async createDraft(input: {
    supplierId: string;
    expectedAt?: Date | null;
    notes?: string | null;
    currency?: string;
    shippingCost?: number;
    dutyCost?: number;
    otherCost?: number;
    items: PurchaseOrderLineInput[];
    createdBy?: string | null;
  }) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: input.supplierId },
      select: { id: true, isActive: true },
    });
    if (!supplier) throw new NotFoundError('Supplier not found');
    if (!supplier.isActive) throw new BadRequestError('That supplier is no longer active');

    assertDistinctVariants(input.items);

    return prisma.purchaseOrder.create({
      data: {
        supplierId: input.supplierId,
        poNumber: newPoNumber(),
        currency: input.currency ?? 'PKR',
        expectedAt: input.expectedAt ?? null,
        notes: input.notes ?? null,
        shippingCost: dec(input.shippingCost ?? 0),
        dutyCost: dec(input.dutyCost ?? 0),
        otherCost: dec(input.otherCost ?? 0),
        createdBy: input.createdBy ?? null,
        items: {
          create: input.items.map((line) => ({
            variantId: line.variantId,
            quantityOrdered: line.quantityOrdered,
            unitCost: dec(line.unitCost),
          })),
        },
      },
      include: { items: true },
    });
  },

  /** Amend a draft: header fields and the full line set are replaced. */
  async updateDraft(
    poId: string,
    input: {
      expectedAt?: Date | null;
      notes?: string | null;
      shippingCost?: number;
      dutyCost?: number;
      otherCost?: number;
      items?: PurchaseOrderLineInput[];
    },
  ) {
    const po = await requirePo(poId);
    if (po.status !== 'DRAFT') {
      throw new ConflictError('Only a draft purchase order can be edited');
    }
    if (input.items) assertDistinctVariants(input.items);

    return prisma.$transaction(async (tx) => {
      if (input.items) {
        // No receipts can exist against a draft, so replacing the lines
        // outright cannot orphan any received quantity.
        await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: poId } });
        await tx.purchaseOrderItem.createMany({
          data: input.items.map((line) => ({
            purchaseOrderId: poId,
            variantId: line.variantId,
            quantityOrdered: line.quantityOrdered,
            unitCost: dec(line.unitCost),
          })),
        });
      }

      return tx.purchaseOrder.update({
        where: { id: poId },
        data: {
          expectedAt: input.expectedAt ?? undefined,
          notes: input.notes ?? undefined,
          shippingCost: input.shippingCost === undefined ? undefined : dec(input.shippingCost),
          dutyCost: input.dutyCost === undefined ? undefined : dec(input.dutyCost),
          otherCost: input.otherCost === undefined ? undefined : dec(input.otherCost),
        },
        include: { items: true },
      });
    });
  },

  /** Send the order to the supplier. From here the lines are fixed. */
  async submit(poId: string) {
    const po = await requirePo(poId);
    if (po.status !== 'DRAFT') throw new ConflictError('This purchase order is already submitted');
    if (po.items.length === 0) throw new BadRequestError('Add at least one line before submitting');

    // The status guard sits in the WHERE so two clicks can't both submit.
    const { count } = await prisma.purchaseOrder.updateMany({
      where: { id: poId, status: 'DRAFT' },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });
    if (count === 0) throw new ConflictError('This purchase order is already submitted');
    return { id: poId, status: 'SUBMITTED' as const };
  },

  /**
   * Abandon an order. Anything already delivered stays in stock — cancelling
   * is not a reversal, so an order with receipts against it must be closed by
   * receiving the rest or amended, not cancelled.
   */
  async cancel(poId: string) {
    const po = await requirePo(poId);
    if (po.status === 'RECEIVED') throw new ConflictError('This purchase order is complete');
    if (po.status === 'CANCELLED') return { id: poId, status: 'CANCELLED' as const };
    if (po.items.some((item) => item.quantityReceived > 0)) {
      throw new ConflictError('Part of this order has already been received');
    }

    await prisma.purchaseOrder.updateMany({
      where: { id: poId, status: { notIn: ['RECEIVED', 'CANCELLED'] } },
      data: { status: 'CANCELLED', closedAt: new Date() },
    });
    return { id: poId, status: 'CANCELLED' as const };
  },

  /**
   * Post a delivery: credit stock through the ledger, stamp each unit with its
   * landed cost, and roll the variant's moving average forward.
   *
   * The whole thing is one transaction — a receipt that fails partway would
   * otherwise leave stock credited with no paperwork behind it.
   */
  async receive(input: {
    purchaseOrderId: string;
    lines: ReceiptLineInput[];
    receivedBy?: string | null;
    note?: string | null;
    receivedAt?: Date;
  }) {
    const lines = input.lines.filter((line) => line.quantity > 0);
    if (lines.length === 0) throw new BadRequestError('Enter a quantity for at least one line');

    return prisma.$transaction(async (tx) => {
      // Lock the order for the duration: two receivers posting the same
      // delivery would otherwise both pass the remaining-quantity check.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "purchase_orders" WHERE "id" = ${input.purchaseOrderId}::uuid FOR UPDATE`;
      if (locked.length === 0) throw new NotFoundError('Purchase order not found');

      const po = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: input.purchaseOrderId },
        include: { items: true },
      });
      if (!RECEIVABLE.has(po.status)) {
        throw new ConflictError(`A ${po.status.toLowerCase()} purchase order cannot be received`);
      }

      const itemsById = new Map(po.items.map((item) => [item.id, item]));
      const factor = landedCostFactor(orderedValue(po.items), extraCharges(po));

      const receipt = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId: po.id,
          receivedAt: input.receivedAt ?? new Date(),
          receivedBy: input.receivedBy ?? null,
          note: input.note ?? null,
        },
      });

      for (const line of lines) {
        const item = itemsById.get(line.purchaseOrderItemId);
        if (!item) throw new BadRequestError('That line is not on this purchase order');

        const outstanding = item.quantityOrdered - item.quantityReceived;
        if (line.quantity > outstanding) {
          throw new BadRequestError(
            `Only ${outstanding} outstanding on that line — amend the order to receive more`,
          );
        }

        const landed = unitLandedCost(item.unitCost, factor);

        await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: receipt.id,
            purchaseOrderItemId: item.id,
            variantId: item.variantId,
            quantity: line.quantity,
            unitLandedCost: landed,
          },
        });

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { quantityReceived: { increment: line.quantity } },
        });
        item.quantityReceived += line.quantity;

        const balance = await inventoryService.applyDelta(
          {
            variantId: item.variantId,
            delta: line.quantity,
            reason: 'PURCHASE_RECEIPT',
            refType: 'GOODS_RECEIPT',
            refId: receipt.id,
            unitCost: landed,
            createdBy: input.receivedBy ?? null,
          },
          tx,
        );
        if (balance === null) throw new NotFoundError('That variant no longer exists');

        // Average against the stock that was on hand before this delivery.
        const variant = await tx.productVariant.findUniqueOrThrow({
          where: { id: item.variantId },
          select: { avgCost: true },
        });
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: {
            avgCost: movingAverageCost(
              variant.avgCost,
              balance - line.quantity,
              landed,
              line.quantity,
            ),
          },
        });
      }

      const status = statusAfterReceipt(po.items);
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status, closedAt: status === 'RECEIVED' ? new Date() : null },
      });

      return { receiptId: receipt.id, status };
    });
  },

  /** Delete a draft outright. Submitted orders are cancelled, never removed. */
  async deleteDraft(poId: string) {
    const po = await requirePo(poId);
    if (po.status !== 'DRAFT') {
      throw new ConflictError('Only a draft purchase order can be deleted');
    }
    await prisma.purchaseOrder.delete({ where: { id: poId } });
    return { id: poId };
  },
};

async function requirePo(poId: string) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: { items: true },
  });
  if (!po) throw new NotFoundError('Purchase order not found');
  return po;
}

/** The `uq_po_variant` index enforces this too; catching it here reads better. */
function assertDistinctVariants(items: ReadonlyArray<{ variantId: string }>) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.variantId)) {
      throw new BadRequestError('The same variant appears on more than one line');
    }
    seen.add(item.variantId);
  }
}
