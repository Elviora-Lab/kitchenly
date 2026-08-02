import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The ledger's SQL is exercised against a real database elsewhere; what these
 * tests pin down is the decision logic around it — when a movement is written,
 * when it is skipped, and what the caller is told when the stock guard refuses.
 * A regression here silently corrupts stock counts, so it is worth the mock.
 */

/** Rows the fake `$queryRaw` will return, in call order. */
let queryResults: unknown[][] = [];
/** Every `$queryRaw` call: the SQL with placeholders collapsed, plus values. */
let queries: Array<{ sql: string; values: unknown[] }> = [];
let variantRow: { stockQuantity: number } | null = null;

const $queryRaw = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
  queries.push({ sql: strings.join('?').replace(/\s+/g, ' ').trim(), values });
  return Promise.resolve(queryResults.shift() ?? []);
});

const fakeDb = {
  $queryRaw,
  productVariant: { findUnique: vi.fn(() => Promise.resolve(variantRow)) },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => Promise.resolve(fn(fakeDb))),
};

vi.mock('@/lib/db', () => ({ prisma: fakeDb }));

const { applyDelta, setLevel, restoreForOrder } =
  await import('@/server/services/inventory.service');

beforeEach(() => {
  queryResults = [];
  queries = [];
  variantRow = null;
  $queryRaw.mockClear();
  fakeDb.productVariant.findUnique.mockClear();
});

describe('applyDelta', () => {
  it('returns the new balance and records one movement', async () => {
    queryResults = [[{ balance_after: 7 }]];

    const balance = await applyDelta({
      variantId: 'v1',
      delta: -3,
      reason: 'SALE',
      refType: 'ORDER',
      refId: 'o1',
    });

    expect(balance).toBe(7);
    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toContain('INSERT INTO "stock_movements"');
    expect(queries[0]?.values).toContain(-3);
  });

  it('guards the decrement inside the UPDATE, not in application code', async () => {
    queryResults = [[{ balance_after: 0 }]];
    await applyDelta({ variantId: 'v1', delta: -1, reason: 'SALE' });

    // The `>= 0` predicate is what makes two concurrent last-unit checkouts
    // safe. If it ever moves out of the WHERE clause, oversell becomes possible.
    expect(queries[0]?.sql).toContain('>= 0');
  });

  it('reports a refused decrement as null rather than throwing', async () => {
    // Zero rows back — the variant had less stock than the caller asked for.
    queryResults = [[]];

    const balance = await applyDelta({ variantId: 'v1', delta: -99, reason: 'SALE' });

    expect(balance).toBeNull();
  });

  it('writes no movement for a zero delta and reports the current balance', async () => {
    variantRow = { stockQuantity: 12 };

    const balance = await applyDelta({ variantId: 'v1', delta: 0, reason: 'ADJUSTMENT' });

    expect(balance).toBe(12);
    // A zero-delta row is rejected by the CHECK constraint; we must not try.
    expect($queryRaw).not.toHaveBeenCalled();
  });

  it('refuses a fractional delta — stock is whole units', async () => {
    await expect(applyDelta({ variantId: 'v1', delta: 1.5, reason: 'ADJUSTMENT' })).rejects.toThrow(
      /whole number/,
    );
    expect($queryRaw).not.toHaveBeenCalled();
  });
});

describe('setLevel', () => {
  it('turns an absolute count into a delta against the locked current value', async () => {
    queryResults = [
      [{ stock_quantity: 30 }], // SELECT ... FOR UPDATE
      [{ balance_after: 42 }], // the movement
    ];

    const balance = await setLevel({ variantId: 'v1', quantity: 42, reason: 'ADJUSTMENT' });

    expect(balance).toBe(42);
    expect(queries[0]?.sql).toContain('FOR UPDATE');
    // 42 on the shelf when 30 were counted is a credit of 12, not a blind set.
    expect(queries[1]?.values).toContain(12);
  });

  it('computes a negative delta when the count came down', async () => {
    queryResults = [[{ stock_quantity: 30 }], [{ balance_after: 25 }]];

    await setLevel({ variantId: 'v1', quantity: 25, reason: 'DAMAGE' });

    expect(queries[1]?.values).toContain(-5);
  });

  it('writes nothing when the figure is unchanged', async () => {
    queryResults = [[{ stock_quantity: 30 }]];

    const balance = await setLevel({ variantId: 'v1', quantity: 30, reason: 'IMPORT_SYNC' });

    expect(balance).toBe(30);
    // Re-importing an unchanged file must not fill the history with noise.
    expect(queries).toHaveLength(1);
  });

  it('rejects a negative target instead of clamping it', async () => {
    await expect(setLevel({ variantId: 'v1', quantity: -1, reason: 'ADJUSTMENT' })).rejects.toThrow(
      /non-negative/,
    );
  });

  it('fails loudly when the variant is gone', async () => {
    queryResults = [[]];

    await expect(
      setLevel({ variantId: 'ghost', quantity: 5, reason: 'ADJUSTMENT' }),
    ).rejects.toThrow(/not found/);
  });
});

describe('restoreForOrder', () => {
  it('credits every line of the order in a single statement', async () => {
    queryResults = [[{ balance_after: 4 }, { balance_after: 9 }]];

    const restored = await restoreForOrder('o1');

    expect(restored).toBe(2);
    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toContain('ORDER_RESTOCK');
  });

  it('is a no-op for an order with no variant-backed lines', async () => {
    queryResults = [[]];

    expect(await restoreForOrder('o1')).toBe(0);
  });
});
