/**
 * Shipping & tax calculator — PostEx (Tier 1) rate card.
 *
 * Single source of truth shared by the checkout UI (live estimate) and the
 * order service (the authoritative charge), so what the customer sees is
 * exactly what is stored on the order.
 *
 * Origin is Karachi (Sindh). Zones, relative to origin:
 *   - within_city         — same city as origin (Karachi)
 *   - same_province       — another city in the origin's province (Sindh)
 *   - province_to_province — any other province
 *
 * Base rates below are exclusive of tax. On top of the base:
 *   + 35% fuel surcharge
 *   + 15% GST on the shipping service (base + fuel)
 *   + 4% tax on the COD amount for cash-on-delivery orders
 *     (2% income tax + 2% sales tax)
 */

export type ShippingZone = 'within_city' | 'same_province' | 'province_to_province';

export type CheckoutPaymentMethod = 'COD' | 'CARD';

export const FUEL_SURCHARGE_RATE = 0.35;
export const GST_RATE = 0.15;
export const COD_TAX_RATE = 0.04; // 2% income tax + 2% sales tax

/**
 * Orders whose merchandise **subtotal** (before any discount) reaches this
 * amount ship free — the delivery charge and its 15% GST are both waived. COD
 * tax, which is levied on the cash collected at the door, still applies. Judged
 * pre-discount so a Spend & Save reward can't cancel free shipping.
 */
export const FREE_SHIPPING_THRESHOLD = 8000;

/** Our product line is ~120 g; used when a variant has no explicit weight. */
export const DEFAULT_ITEM_WEIGHT_KG = 0.12;

// Base (pre-tax) rupee rates per weight slab, per zone. See the PostEx rate card.
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
 * Cheapest possible delivery charge for a cart of `quantity` items, inclusive
 * of fuel surcharge and GST — the floor behind "from Rs X" copy in the cart.
 */
export function cheapestShippingFrom(quantity = 1): number {
  const weightKg = Math.max(1, quantity) * DEFAULT_ITEM_WEIGHT_KG;
  const fee = baseShippingRate(CHEAPEST_ZONE, weightKg) * (1 + FUEL_SURCHARGE_RATE);
  return Math.round(fee * (1 + GST_RATE));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Pre-tax base shipping rate for a given zone and total weight. */
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
  /** True when the order qualified for free shipping (fee & its GST waived). */
  freeShipping: boolean;
  /** Delivery charge shown as "Shipping" = base + fuel surcharge. */
  shippingFee: number;
  /** 15% GST on the shipping service. */
  gst: number;
  /** 4% COD tax (0 for non-COD). */
  codTax: number;
  /** Combined tax line shown as "Tax" = GST + COD tax. */
  taxAmount: number;
  /** subtotal − discount + shipping + tax. */
  total: number;
};

/**
 * Compute the shipping fee, tax, and grand total for an order.
 *
 * @param subtotal    Cart subtotal (sum of line prices), before discount.
 * @param discount    Coupon discount applied to the subtotal.
 * @param city        Destination city (free text is fine; matched leniently).
 * @param quantity    Total item quantity — weight is quantity × item weight.
 * @param paymentMethod  COD triggers the 4% COD tax.
 */
export function computeCheckoutTotals(params: {
  subtotal: number;
  discount?: number;
  city: string | null | undefined;
  quantity: number;
  /** COD triggers the 4% COD tax; accepts the DB PaymentMethod enum too. */
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
  // free shipping. At/above the threshold: no base rate, fuel, or shipping GST.
  const freeShipping = params.subtotal >= FREE_SHIPPING_THRESHOLD;
  const base = freeShipping ? 0 : baseShippingRate(zone, weightKg);
  const fuel = base * FUEL_SURCHARGE_RATE;
  const shippingFee = round2(base + fuel);

  const gst = round2(shippingFee * GST_RATE);
  // COD tax is charged on the amount collected at the door, computed on the
  // pre-COD-tax total to avoid taxing the tax.
  const codTax =
    params.paymentMethod === 'COD' ? round2((merchandise + shippingFee + gst) * COD_TAX_RATE) : 0;
  const taxAmount = round2(gst + codTax);

  const total = round2(merchandise + shippingFee + taxAmount);
  return { zone, freeShipping, shippingFee, gst, codTax, taxAmount, total };
}
