export type ProductIntentCounts = {
  views: number;
  carts: number;
  purchases: number;
};

export type ProductIntentSignal =
  | 'Scale winner'
  | 'Fix PDP'
  | 'Fix checkout/offer'
  | 'Build demand'
  | 'Watch';

export function rate(num: number, denom: number): number {
  return denom > 0 ? num / denom : 0;
}

export function productIntentScore(counts: ProductIntentCounts): number {
  const cartRate = rate(counts.carts, counts.views);
  const purchaseRate = rate(counts.purchases, counts.views);
  const cartToPurchaseRate = rate(counts.purchases, counts.carts);
  const volume = Math.min(counts.views / 100, 1);

  return Math.round(
    (purchaseRate * 50 + cartToPurchaseRate * 30 + cartRate * 15 + volume * 5) * 100,
  );
}

export function productIntentSignal(counts: ProductIntentCounts): ProductIntentSignal {
  const cartRate = rate(counts.carts, counts.views);
  const cartToPurchaseRate = rate(counts.purchases, counts.carts);

  if (counts.purchases >= 2 && cartToPurchaseRate >= 0.35) return 'Scale winner';
  if (counts.views >= 10 && cartRate < 0.04) return 'Fix PDP';
  if (counts.carts >= 3 && cartToPurchaseRate < 0.2) return 'Fix checkout/offer';
  if (counts.views >= 5 && counts.carts >= 1) return 'Build demand';
  return 'Watch';
}

export function pctText(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
