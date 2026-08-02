import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  applyDelta,
  inventoryService,
  restoreForOrder,
  setLevel,
} from '@/server/services/inventory.service';

/**
 * The ledger's correctness lives in raw SQL — CTEs, an UPDATE with a guard in
 * its WHERE clause, and explicit parameter casts. None of that is exercised by
 * a mock, so these run against a real Postgres.
 *
 * Skipped automatically when no migrated database is reachable, which keeps
 * `npm test` green on a laptop with nothing running.
 */
async function connect(): Promise<PrismaClient | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const client = new PrismaClient();
    // Probes the table too, not just the connection — in CI the database
    // exists before the migrations have been applied.
    await client.$queryRaw`SELECT 1 FROM "stock_movements" LIMIT 1`;
    return client;
  } catch {
    return null;
  }
}

const client = await connect();
const describeDb = client ? describe : describe.skip;
// Only ever dereferenced inside a suite that runs, i.e. when `client` is set.
const prisma = client ?? ({} as PrismaClient);

let productId = '';
let variantA = '';
let variantB = '';

beforeAll(async () => {
  if (!client) return;
  const product = await prisma.product.create({
    data: {
      name: 'Ledger Test Product',
      slug: `ledger-test-${Date.now()}`,
      sku: `LT-${Date.now()}`,
      price: '1000',
    },
  });
  productId = product.id;

  const a = await prisma.productVariant.create({
    data: { productId, sku: `LT-A-${Date.now()}`, price: '1000', stockQuantity: 0 },
  });
  const b = await prisma.productVariant.create({
    data: { productId, sku: `LT-B-${Date.now()}`, price: '1000', stockQuantity: 0 },
  });
  variantA = a.id;
  variantB = b.id;
});

afterAll(async () => {
  if (!client) return;
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.$disconnect();
});

const stockOf = async (id: string) =>
  (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;

describeDb('applyDelta against Postgres', () => {
  it('credits stock and writes a matching movement', async () => {
    const balance = await applyDelta({
      variantId: variantA,
      delta: 50,
      reason: 'OPENING_BALANCE',
      refType: 'MANUAL',
      unitCost: 12.5,
      note: 'first receipt',
    });

    expect(balance).toBe(50);
    expect(await stockOf(variantA)).toBe(50);

    const movements = await prisma.stockMovement.findMany({ where: { variantId: variantA } });
    expect(movements).toHaveLength(1);
    expect(movements[0]?.delta).toBe(50);
    expect(movements[0]?.balanceAfter).toBe(50);
    expect(Number(movements[0]?.unitCost)).toBe(12.5);
    expect(movements[0]?.note).toBe('first receipt');
  });

  it('debits stock', async () => {
    expect(await applyDelta({ variantId: variantA, delta: -20, reason: 'SALE' })).toBe(30);
    expect(await stockOf(variantA)).toBe(30);
  });

  it('refuses to go negative and leaves both the column and history untouched', async () => {
    const before = await prisma.stockMovement.count({ where: { variantId: variantA } });

    expect(await applyDelta({ variantId: variantA, delta: -999, reason: 'SALE' })).toBeNull();

    expect(await stockOf(variantA)).toBe(30);
    expect(await prisma.stockMovement.count({ where: { variantId: variantA } })).toBe(before);
  });

  it('returns null for a variant that does not exist', async () => {
    const ghost = '00000000-0000-4000-8000-000000000000';
    expect(await applyDelta({ variantId: ghost, delta: 5, reason: 'ADJUSTMENT' })).toBeNull();
  });

  it('accepts a null actor, ref and cost', async () => {
    expect(await applyDelta({ variantId: variantB, delta: 5, reason: 'IMPORT_SYNC' })).toBe(5);
  });
});

describeDb('setLevel against Postgres', () => {
  it('derives the delta from the current value', async () => {
    expect(await setLevel({ variantId: variantA, quantity: 42, reason: 'ADJUSTMENT' })).toBe(42);

    const latest = await prisma.stockMovement.findFirst({
      where: { variantId: variantA },
      orderBy: { createdAt: 'desc' },
    });
    expect(latest?.delta).toBe(12);
    expect(latest?.balanceAfter).toBe(42);
  });

  it('writes nothing when the count is unchanged', async () => {
    const before = await prisma.stockMovement.count({ where: { variantId: variantA } });
    expect(await setLevel({ variantId: variantA, quantity: 42, reason: 'IMPORT_SYNC' })).toBe(42);
    expect(await prisma.stockMovement.count({ where: { variantId: variantA } })).toBe(before);
  });

  it('can take stock down to zero', async () => {
    expect(await setLevel({ variantId: variantA, quantity: 0, reason: 'LOSS' })).toBe(0);
    expect(await stockOf(variantA)).toBe(0);
  });
});

describeDb('restoreForOrder against Postgres', () => {
  it('credits every line and records one movement per variant', async () => {
    await setLevel({ variantId: variantA, quantity: 10, reason: 'ADJUSTMENT' });
    await setLevel({ variantId: variantB, quantity: 10, reason: 'ADJUSTMENT' });

    const order = await prisma.order.create({
      data: {
        orderNumber: `LT-${Date.now()}`,
        subtotal: '0',
        totalAmount: '0',
        items: {
          create: [
            {
              productId,
              variantId: variantA,
              productName: 'A',
              quantity: 3,
              unitPrice: '1',
              totalPrice: '3',
            },
            // Two lines for the same variant must be summed, not double-counted.
            {
              productId,
              variantId: variantA,
              productName: 'A',
              quantity: 2,
              unitPrice: '1',
              totalPrice: '2',
            },
            {
              productId,
              variantId: variantB,
              productName: 'B',
              quantity: 4,
              unitPrice: '1',
              totalPrice: '4',
            },
          ],
        },
      },
    });

    expect(await restoreForOrder(order.id)).toBe(2);
    expect(await stockOf(variantA)).toBe(15);
    expect(await stockOf(variantB)).toBe(14);

    const restocks = await prisma.stockMovement.findMany({
      where: { reason: 'ORDER_RESTOCK', refId: order.id },
    });
    expect(restocks).toHaveLength(2);
    expect(restocks.map((m) => m.delta).sort((a, b) => a - b)).toEqual([4, 5]);

    await prisma.order.delete({ where: { id: order.id } });
  });
});

describeDb('ledger integrity', () => {
  it('reports no drift while everything goes through the service', async () => {
    const drift = await inventoryService.findDrift();
    expect(drift.filter((d) => d.variant_id === variantA || d.variant_id === variantB)).toEqual([]);
  });

  it('detects a write that bypassed the service', async () => {
    await prisma.productVariant.update({
      where: { id: variantA },
      data: { stockQuantity: { increment: 7 } },
    });

    const drift = await inventoryService.findDrift();
    const row = drift.find((d) => d.variant_id === variantA);
    expect(row).toBeDefined();
    expect(row?.cached).toBe((row?.ledger ?? 0) + 7);

    await prisma.productVariant.update({
      where: { id: variantA },
      data: { stockQuantity: { decrement: 7 } },
    });
  });

  it('rejects a zero-delta movement at the database', async () => {
    await expect(
      prisma.stockMovement.create({
        data: { variantId: variantA, delta: 0, balanceAfter: 1, reason: 'ADJUSTMENT' },
      }),
    ).rejects.toThrow();
  });

  it('discards a deleted variant\u2019s history along with the variant', async () => {
    // Cascade is deliberate: a variant with order history cannot be deleted
    // (see `deleteVariant`), so anything that does get removed has no sales to
    // account for and its movements are of no further use.
    const throwaway = await prisma.productVariant.create({
      data: { productId, sku: `LT-C-${Date.now()}`, price: '1000', stockQuantity: 0 },
    });
    await applyDelta({ variantId: throwaway.id, delta: 3, reason: 'OPENING_BALANCE' });
    expect(await prisma.stockMovement.count({ where: { variantId: throwaway.id } })).toBe(1);

    await prisma.productVariant.delete({ where: { id: throwaway.id } });
    expect(await prisma.stockMovement.count({ where: { variantId: throwaway.id } })).toBe(0);
  });
});
