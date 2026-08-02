import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { inventoryRepo } from '@/server/repositories/inventory.repo';
import { inventoryService } from '@/server/services/inventory.service';
import { purchasingService } from '@/server/services/purchasing.service';

/**
 * The purchasing flow end to end: order, receive, and the effect on stock and
 * cost. Skipped when no migrated database is reachable — see the note in
 * `inventory.db.test.ts`.
 */
async function connect(): Promise<PrismaClient | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const client = new PrismaClient();
    await client.$queryRaw`SELECT 1 FROM "purchase_orders" LIMIT 1`;
    return client;
  } catch {
    return null;
  }
}

const client = await connect();
const describeDb = client ? describe : describe.skip;
const prisma = client ?? ({} as PrismaClient);

const tag = Date.now();
let supplierId = '';
let productId = '';
let variantA = '';
let variantB = '';

beforeAll(async () => {
  if (!client) return;

  const supplier = await prisma.supplier.create({
    data: { name: `Test Supplier ${tag}`, slug: `test-supplier-${tag}`, leadTimeDays: 7 },
  });
  supplierId = supplier.id;

  const product = await prisma.product.create({
    data: {
      name: 'Purchasing Test Product',
      slug: `purchasing-test-${tag}`,
      sku: `PT-${tag}`,
      price: '1000',
    },
  });
  productId = product.id;

  const a = await prisma.productVariant.create({
    data: { productId, sku: `PT-A-${tag}`, price: '1000', stockQuantity: 0 },
  });
  const b = await prisma.productVariant.create({
    data: { productId, sku: `PT-B-${tag}`, price: '1000', stockQuantity: 0 },
  });
  variantA = a.id;
  variantB = b.id;
});

afterAll(async () => {
  if (!client) return;
  await prisma.purchaseOrder.deleteMany({ where: { supplierId } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.supplier.deleteMany({ where: { id: supplierId } });
  await prisma.$disconnect();
});

const variant = (id: string) => prisma.productVariant.findUniqueOrThrow({ where: { id } });

/** A submitted order for 10 × 100 and 10 × 400, with 1,000 of shipping. */
async function submittedOrder(shippingCost = 1000) {
  const po = await purchasingService.createDraft({
    supplierId,
    shippingCost,
    items: [
      { variantId: variantA, quantityOrdered: 10, unitCost: 100 },
      { variantId: variantB, quantityOrdered: 10, unitCost: 400 },
    ],
  });
  await purchasingService.submit(po.id);
  return po;
}

describeDb('purchase order lifecycle', () => {
  it('opens as a draft with a generated number', async () => {
    const po = await purchasingService.createDraft({
      supplierId,
      items: [{ variantId: variantA, quantityOrdered: 5, unitCost: 100 }],
    });

    expect(po.status).toBe('DRAFT');
    expect(po.poNumber).toMatch(/^PO-\d{4}-[0-9A-Z]{6}$/);
    expect(po.items).toHaveLength(1);

    await purchasingService.deleteDraft(po.id);
  });

  it('refuses two lines for the same variant', async () => {
    await expect(
      purchasingService.createDraft({
        supplierId,
        items: [
          { variantId: variantA, quantityOrdered: 5, unitCost: 100 },
          { variantId: variantA, quantityOrdered: 3, unitCost: 90 },
        ],
      }),
    ).rejects.toThrow(/more than one line/);
  });

  it('will not receive against a draft', async () => {
    const po = await purchasingService.createDraft({
      supplierId,
      items: [{ variantId: variantA, quantityOrdered: 5, unitCost: 100 }],
    });
    const item = po.items[0];

    await expect(
      purchasingService.receive({
        purchaseOrderId: po.id,
        lines: [{ purchaseOrderItemId: item?.id ?? '', quantity: 1 }],
      }),
    ).rejects.toThrow(/cannot be received/);

    await purchasingService.deleteDraft(po.id);
  });

  it('will not edit or delete a submitted order', async () => {
    const po = await submittedOrder();

    await expect(purchasingService.updateDraft(po.id, { notes: 'nope' })).rejects.toThrow(
      /only a draft/i,
    );
    await expect(purchasingService.deleteDraft(po.id)).rejects.toThrow(/only a draft/i);

    await purchasingService.cancel(po.id);
  });
});

describeDb('receiving', () => {
  it('credits stock at landed cost and closes the order', async () => {
    const po = await submittedOrder(1000);
    const items = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: po.id },
      orderBy: { unitCost: 'asc' },
    });
    const [cheap, dear] = items;

    const before = {
      a: (await variant(variantA)).stockQuantity,
      b: (await variant(variantB)).stockQuantity,
    };

    const result = await purchasingService.receive({
      purchaseOrderId: po.id,
      lines: [
        { purchaseOrderItemId: cheap?.id ?? '', quantity: 10 },
        { purchaseOrderItemId: dear?.id ?? '', quantity: 10 },
      ],
    });

    expect(result.status).toBe('RECEIVED');

    // 1,000 shipping over a 5,000 order is 20% on top: 100 → 120, 400 → 480.
    const receiptItems = await prisma.goodsReceiptItem.findMany({
      where: { goodsReceiptId: result.receiptId },
      orderBy: { unitLandedCost: 'asc' },
    });
    expect(receiptItems.map((r) => Number(r.unitLandedCost))).toEqual([120, 480]);

    expect((await variant(variantA)).stockQuantity).toBe(before.a + 10);
    expect((await variant(variantB)).stockQuantity).toBe(before.b + 10);

    // Nothing was on hand, so the average cost is simply the landed cost.
    expect(Number((await variant(variantA)).avgCost)).toBe(120);
    expect(Number((await variant(variantB)).avgCost)).toBe(480);

    const closed = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(closed.closedAt).not.toBeNull();
  });

  it('writes a ledger movement per line, pointing at the receipt', async () => {
    const po = await submittedOrder(0);
    const items = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });

    const result = await purchasingService.receive({
      purchaseOrderId: po.id,
      lines: items.map((item) => ({ purchaseOrderItemId: item.id, quantity: 10 })),
    });

    const movements = await prisma.stockMovement.findMany({
      where: { reason: 'PURCHASE_RECEIPT', refId: result.receiptId },
    });
    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.refType === 'GOODS_RECEIPT')).toBe(true);
    expect(movements.every((m) => m.delta === 10)).toBe(true);
    // No shipping this time, so the ledger's unit cost is the raw line cost.
    expect(movements.map((m) => Number(m.unitCost)).sort((x, y) => x - y)).toEqual([100, 400]);
  });

  it('handles a partial delivery and the follow-up drop', async () => {
    const po = await submittedOrder(0);
    const items = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId: po.id },
      orderBy: { unitCost: 'asc' },
    });
    const [first, second] = items;

    const partial = await purchasingService.receive({
      purchaseOrderId: po.id,
      lines: [{ purchaseOrderItemId: first?.id ?? '', quantity: 4 }],
    });
    expect(partial.status).toBe('PARTIALLY_RECEIVED');

    const midway = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } });
    expect(midway.closedAt).toBeNull();

    const rest = await purchasingService.receive({
      purchaseOrderId: po.id,
      lines: [
        { purchaseOrderItemId: first?.id ?? '', quantity: 6 },
        { purchaseOrderItemId: second?.id ?? '', quantity: 10 },
      ],
    });
    expect(rest.status).toBe('RECEIVED');

    const line = await prisma.purchaseOrderItem.findUniqueOrThrow({
      where: { id: first?.id ?? '' },
    });
    expect(line.quantityReceived).toBe(10);
  });

  it('refuses more than was ordered', async () => {
    const po = await submittedOrder(0);
    const items = await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: po.id } });

    await expect(
      purchasingService.receive({
        purchaseOrderId: po.id,
        lines: [{ purchaseOrderItemId: items[0]?.id ?? '', quantity: 11 }],
      }),
    ).rejects.toThrow(/outstanding/);

    // The rejected receipt must leave nothing behind.
    expect(await prisma.goodsReceipt.count({ where: { purchaseOrderId: po.id } })).toBe(0);

    await purchasingService.cancel(po.id);
  });

  it('rolls the moving average forward on a second delivery', async () => {
    // variantA already holds stock from earlier receipts; reset to a known
    // position so the arithmetic is checkable.
    await inventoryService.setLevel({ variantId: variantA, quantity: 10, reason: 'ADJUSTMENT' });
    await prisma.productVariant.update({ where: { id: variantA }, data: { avgCost: '100' } });

    const po = await purchasingService.createDraft({
      supplierId,
      items: [{ variantId: variantA, quantityOrdered: 10, unitCost: 200 }],
    });
    await purchasingService.submit(po.id);
    const item = await prisma.purchaseOrderItem.findFirstOrThrow({
      where: { purchaseOrderId: po.id },
    });

    await purchasingService.receive({
      purchaseOrderId: po.id,
      lines: [{ purchaseOrderItemId: item.id, quantity: 10 }],
    });

    // 10 at 100 plus 10 at 200 averages 150.
    expect(Number((await variant(variantA)).avgCost)).toBe(150);
    expect((await variant(variantA)).stockQuantity).toBe(20);
  });
});

describeDb('cancellation', () => {
  it('cancels an untouched order', async () => {
    const po = await submittedOrder(0);
    expect((await purchasingService.cancel(po.id)).status).toBe('CANCELLED');
  });

  it('refuses to cancel once part of it has arrived', async () => {
    const po = await submittedOrder(0);
    const item = await prisma.purchaseOrderItem.findFirstOrThrow({
      where: { purchaseOrderId: po.id },
    });
    await purchasingService.receive({
      purchaseOrderId: po.id,
      lines: [{ purchaseOrderItemId: item.id, quantity: 1 }],
    });

    await expect(purchasingService.cancel(po.id)).rejects.toThrow(/already been received/);
  });
});

describeDb('reporting', () => {
  it('values stock at moving-average cost', async () => {
    const valuation = await inventoryRepo.valuation();
    expect(valuation.totalValue).toBeGreaterThan(0);
    expect(valuation.costedUnits).toBeGreaterThan(0);
  });

  it('leaves the ledger reconciled after all that receiving', async () => {
    const drift = await inventoryService.findDrift();
    const ours = drift.filter((d) => d.variant_id === variantA || d.variant_id === variantB);
    expect(ours).toEqual([]);
  });
});
