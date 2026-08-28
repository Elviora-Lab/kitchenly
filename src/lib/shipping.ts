/**
 * Shipping calculator.
 *
 * Single source of truth shared by the checkout UI (live estimate) and the
 * order service (the authoritative charge), so what the customer sees is
 * exactly what is stored on the order.
 *
 * Customer-facing delivery:
 *   - Karachi: flat Rs 200
 *   - Sindh outside Karachi: flat Rs 220
 *   - Other provinces: flat Rs 220
 *   - No separate tax/COD line is shown to the customer
 */

export type ShippingZone = 'within_city' | 'same_province' | 'province_to_province';

export type CheckoutPaymentMethod = 'COD' | 'CARD';

export const KARACHI_SHIPPING_FEE = 200;
export const SINDH_SHIPPING_FEE = 220;
export const OTHER_PROVINCE_SHIPPING_FEE = 220;

/**
 * Orders whose merchandise **subtotal** (before any discount) reaches this
 * amount ship free. Judged pre-discount so a Spend & Save reward can't cancel
 * free shipping.
 */
export const FREE_SHIPPING_THRESHOLD = 8000;

/** Our product line is ~120 g; used when a variant has no explicit weight. */
export const DEFAULT_ITEM_WEIGHT_KG = 0.12;

const FLAT_SHIPPING_FEES: Record<ShippingZone, number> = {
  within_city: KARACHI_SHIPPING_FEE,
  same_province: SINDH_SHIPPING_FEE,
  province_to_province: OTHER_PROVINCE_SHIPPING_FEE,
};

// Cities in the origin province (Sindh) → same_province rate. Everything not
// listed here and not recognised as Karachi falls back to province_to_province,
// so an unknown city is never under-charged.
const KARACHI_ALIASES = new Set(['karachi', 'khi', 'karachi city', 'kharachi']);
const SINDH_CITIES = new Set([
  'hyderabad',
  'sukkur',
  'larkana',
  'nawabshah',
  'shaheed benazirabad',
  'mirpur khas',
  'mirpurkhas',
  'jacobabad',
  'shikarpur',
  'khairpur',
  'dadu',
  'thatta',
  'badin',
  'tando adam',
  'tando allahyar',
  'tando muhammad khan',
  'ghotki',
  'umerkot',
  'kandhkot',
  'kambar',
  'qambar',
  'sanghar',
  'matiari',
  'jamshoro',
  'naushahro feroze',
  'kashmore',
  'sujawal',
  'gambat',
  'rohri',
  'mehar',
  'moro',
  'kotri',
  'tando jam',
  'digri',
  'mithi',
  'daharki',
  'pano akil',
  'ratodero',
]);

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveZone(city: string | null | undefined): ShippingZone {
  const key = normalizeCity(city ?? '');
  if (!key) return 'province_to_province';
  if (KARACHI_ALIASES.has(key)) return 'within_city';
  if (SINDH_CITIES.has(key)) return 'same_province';
  return 'province_to_province';
}

/**
 * The cheapest zone on the rate card — used for optimistic "from Rs X"
 * estimates before the customer has told us their city. Display only: the
 * authoritative charge always resolves the zone from the real address.
 */
export const CHEAPEST_ZONE: ShippingZone = 'within_city';

/**
 * Cheapest possible delivery charge — the floor behind "from Rs X" copy in the cart.
 */
export function cheapestShippingFrom(_quantity = 1): number {
  return KARACHI_SHIPPING_FEE;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Customer-facing flat shipping fee for a given zone. */
export function shippingFeeForZone(zone: ShippingZone): number {
  return FLAT_SHIPPING_FEES[zone];
}

export type CheckoutTotals = {
  zone: ShippingZone;
  /** True when the order qualified for free shipping. */
  freeShipping: boolean;
  /** Delivery charge shown as "Shipping". */
  shippingFee: number;
  /** Reserved for compatibility with stored orders and analytics. */
  gst: number;
  /** Reserved for compatibility with stored orders and analytics. */
  codTax: number;
  /** Combined tax line shown when non-zero. */
  taxAmount: number;
  /** subtotal - discount + shipping. */
  total: number;
};

/**
 * Compute the shipping fee and grand total for an order.
 *
 * @param subtotal    Cart subtotal (sum of line prices), before discount.
 * @param discount    Coupon discount applied to the subtotal.
 * @param city        Destination city (free text is fine; matched leniently).
 * @param quantity    Kept for call-site compatibility; flat rates ignore it.
 * @param paymentMethod  Kept for call-site compatibility; flat rates ignore it.
 */
export function computeCheckoutTotals(params: {
  subtotal: number;
  discount?: number;
  city: string | null | undefined;
  quantity: number;
  /** Accepts the DB PaymentMethod enum too. */
  paymentMethod: string;
  itemWeightKg?: number;
  /**
   * Display-only zone override (e.g. CHEAPEST_ZONE while no city is chosen).
   * The order service never passes this, so the charged amount always comes
   * from the real address via resolveZone.
   */
  zone?: ShippingZone;
}): CheckoutTotals {
  const discount = Math.max(0, params.discount ?? 0);
  const merchandise = Math.max(0, params.subtotal - discount);
  const zone = params.zone ?? resolveZone(params.city);
  // Free shipping is judged on the PRE-discount subtotal, so a Spend & Save
  // reward can never accidentally drop an order below the threshold and cancel
  // free shipping.
  const freeShipping = params.subtotal >= FREE_SHIPPING_THRESHOLD;

  const shippingFee = freeShipping ? 0 : shippingFeeForZone(zone);
  const taxAmount = 0;
  const total = round2(merchandise + shippingFee);
  return { zone, freeShipping, shippingFee, gst: 0, codTax: 0, taxAmount, total };
}
