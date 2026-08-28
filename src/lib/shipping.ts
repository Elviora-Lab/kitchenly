/**
 * Shipping calculator.
 *
 * Single source of truth shared by the checkout UI (live estimate) and the
 * order service (the authoritative charge), so what the customer sees is
 * exactly what is stored on the order.
 *
 * Customer-facing delivery:
 *   - Karachi: flat Rs 200, no separate tax/COD line
 *   - Outside Karachi: courier rate card with fuel surcharge, GST, and COD tax
 *     where applicable
 */

export type ShippingZone = 'within_city' | 'same_province' | 'province_to_province';

export type CheckoutPaymentMethod = 'COD' | 'CARD';

export const KARACHI_SHIPPING_FEE = 200;
export const FUEL_SURCHARGE_RATE = 0.35;
export const GST_RATE = 0.15;
export const COD_TAX_RATE = 0.04; // 2% income tax + 2% sales tax

/**
 * Orders whose merchandise **subtotal** (before any discount) reaches this
 * amount ship free. For non-Karachi COD orders, COD tax still applies because
 * it is levied on the cash collected at the door. Judged pre-discount so a
 * Spend & Save reward can't cancel free shipping.
 */
export const FREE_SHIPPING_THRESHOLD = 8000;

/** Our product line is ~120 g; used when a variant has no explicit weight. */
export const DEFAULT_ITEM_WEIGHT_KG = 0.12;

// Base (pre-tax) rupee rates per weight slab, per zone. Karachi is handled as a
// special flat customer fee in computeCheckoutTotals.
const RATE_TABLE: Record<
  ShippingZone,
  { upToHalfKg: number; upToOneKg: number; eachAdditionalKg: number }
> = {
  within_city: { upToHalfKg: 100, upToOneKg: 110, eachAdditionalKg: 110 },
  same_province: { upToHalfKg: 165, upToOneKg: 185, eachAdditionalKg: 185 },
  province_to_province: { upToHalfKg: 175, upToOneKg: 195, eachAdditionalKg: 180 },
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

/** Pre-tax courier base shipping rate for a given zone and total weight. */
export function baseShippingRate(zone: ShippingZone, weightKg: number): number {
  const rates = RATE_TABLE[zone];
  const weight = Math.max(weightKg, 0);
  if (weight <= 0.5) return rates.upToHalfKg;
  if (weight <= 1) return rates.upToOneKg;
  const extraKg = Math.ceil(weight - 1);
  return rates.upToOneKg + extraKg * rates.eachAdditionalKg;
}

export type CheckoutTotals = {
  zone: ShippingZone;
  /** True when the order qualified for free shipping. */
  freeShipping: boolean;
  /** Delivery charge shown as "Shipping". */
  shippingFee: number;
  /** GST on non-Karachi courier shipping. Karachi flat delivery keeps this 0. */
  gst: number;
  /** COD tax for non-Karachi cash-on-delivery orders. Karachi keeps this 0. */
  codTax: number;
  /** Combined tax line shown when non-zero. */
  taxAmount: number;
  /** subtotal − discount + shipping + any applicable tax. */
  total: number;
};

/**
 * Compute the shipping fee, tax, and grand total for an order.
 *
 * @param subtotal    Cart subtotal (sum of line prices), before discount.
 * @param discount    Coupon discount applied to the subtotal.
 * @param city        Destination city (free text is fine; matched leniently).
 * @param quantity    Total item quantity — weight is quantity × item weight.
 * @param paymentMethod  COD triggers tax outside Karachi.
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
  const weightKg = Math.max(1, params.quantity) * (params.itemWeightKg ?? DEFAULT_ITEM_WEIGHT_KG);
  const zone = params.zone ?? resolveZone(params.city);
  // Free shipping is judged on the PRE-discount subtotal, so a Spend & Save
  // reward can never accidentally drop an order below the threshold and cancel
  // free shipping.
  const freeShipping = params.subtotal >= FREE_SHIPPING_THRESHOLD;

  if (zone === 'within_city') {
    const shippingFee = freeShipping ? 0 : KARACHI_SHIPPING_FEE;
    return {
      zone,
      freeShipping,
      shippingFee,
      gst: 0,
      codTax: 0,
      taxAmount: 0,
      total: round2(merchandise + shippingFee),
    };
  }

  const base = freeShipping ? 0 : baseShippingRate(zone, weightKg);
  const fuel = base * FUEL_SURCHARGE_RATE;
  const shippingFee = round2(base + fuel);
  const gst = round2(shippingFee * GST_RATE);
  const codTax =
    params.paymentMethod === 'COD' ? round2((merchandise + shippingFee + gst) * COD_TAX_RATE) : 0;
  const taxAmount = round2(gst + codTax);

  const total = round2(merchandise + shippingFee + taxAmount);
  return { zone, freeShipping, shippingFee, gst, codTax, taxAmount, total };
}
