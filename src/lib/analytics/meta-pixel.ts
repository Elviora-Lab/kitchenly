import { isProd, publicEnv } from '@/config/env';

import { normalizeCurrencyCode } from '@/lib/currency';

/**
 * Meta (Facebook) Pixel — thin client-side wrapper around `window.fbq`.
 *
 * The base code is injected once by `<MetaPixel />` (see
 * `@/components/analytics/meta-pixel`). These helpers fire standard events from
 * anywhere in the app; they no-op safely until the pixel script has loaded and
 * only run in production, so call sites don't need their own guards.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

export const FB_PIXEL_ID = publicEnv.NEXT_PUBLIC_FB_PIXEL_ID;

/** "true" ⇒ add diagnostics in production only. Never enables local tracking. */
export const pixelDebug = publicEnv.NEXT_PUBLIC_FB_PIXEL_DEBUG === 'true';

/**
 * Load the pixel only when an ID is configured AND this is a production
 * environment. Local development must never load the real Meta script: the
 * browser pixel has no test mode, so any localhost event would hit production
 * Meta infrastructure.
 */
export const pixelEnabled = Boolean(FB_PIXEL_ID) && isProd;

type PixelParams = Record<string, unknown>;

/** Optional opts — `eventID` pairs a browser event with its server (CAPI)
 * counterpart so Meta deduplicates the two. */
type TrackOpts = { eventID?: string };

export function fbTrack(event: string, params?: PixelParams, opts?: TrackOpts): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  if (opts?.eventID) {
    window.fbq('track', event, params, { eventID: opts.eventID });
  } else {
    window.fbq('track', event, params);
  }
}

/** Fire a custom (non-standard) event via `trackCustom`. */
export function fbTrackCustom(event: string, params?: PixelParams): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  window.fbq('trackCustom', event, params);
}

// Advanced matching is applied at most once per (email, phone) pair so a
// repeated call (e.g. re-selecting a payment method) doesn't re-init the pixel.
let lastMatchKey = '';

/**
 * Attach Advanced Matching to the browser pixel. Passing raw email/phone to
 * `fbq('init', …)` lets fbq normalize + SHA-256 them client-side, which lifts
 * Event Match Quality on every subsequent browser event this session. The
 * server (CAPI) sends the same identifiers hashed, so the two dedupe cleanly.
 * No-ops until the pixel has loaded (production only).
 */
export function fbIdentify(user: { email?: string | null; phone?: string | null }): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
  const em = user.email?.trim().toLowerCase() || undefined;
  const ph = user.phone?.replace(/[^0-9]/g, '') || undefined;
  if (!em && !ph) return;
  const key = `${em ?? ''}|${ph ?? ''}`;
  if (key === lastMatchKey) return;
  lastMatchKey = key;
  window.fbq('init', FB_PIXEL_ID, { ...(em ? { em } : {}), ...(ph ? { ph } : {}) });
}

/**
 * Meta requires `value` to be a positive number whenever it's present. Emit
 * `value` + `currency` together only when the amount is finite and > 0 (a free
 * item or a 0-total order otherwise sends `value: 0`, which Meta rejects);
 * otherwise omit both.
 */
function moneyFields(
  value: number | undefined,
  currency: string | undefined,
): Record<string, unknown> {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? { value, currency: normalizeCurrencyCode(currency) }
    : {};
}

export const metaPixel = {
  pageView: () => fbTrack('PageView'),

  viewContent: (
    p: { id: string; name: string; price: number; currency: string },
    eventID?: string,
  ) =>
    fbTrack(
      'ViewContent',
      {
        content_ids: [p.id],
        content_name: p.name,
        content_type: 'product',
        ...moneyFields(p.price, p.currency),
      },
      eventID ? { eventID } : undefined,
    ),

  viewCategory: (p: { slug: string; name: string }) =>
    fbTrackCustom('ViewCategory', { content_category: p.name, content_ids: [p.slug] }),

  addToCart: (
    p: { id: string; name: string; quantity: number; price: number; currency: string },
    eventID?: string,
  ) =>
    fbTrack(
      'AddToCart',
      {
        content_ids: [p.id],
        content_name: p.name,
        content_type: 'product',
        contents: [{ id: p.id, quantity: p.quantity }],
        ...moneyFields(p.price * p.quantity, p.currency),
      },
      eventID ? { eventID } : undefined,
    ),

  addToWishlist: (
    p: { id: string; name?: string; price?: number; currency?: string },
    eventID?: string,
  ) =>
    fbTrack(
      'AddToWishlist',
      {
        content_ids: [p.id],
        content_type: 'product',
        ...(p.name ? { content_name: p.name } : {}),
        ...moneyFields(p.price, p.currency),
      },
      eventID ? { eventID } : undefined,
    ),

  initiateCheckout: (p: { value: number; currency: string; items: number }, eventID?: string) =>
    fbTrack(
      'InitiateCheckout',
      {
        ...moneyFields(p.value, p.currency),
        num_items: p.items,
      },
      eventID ? { eventID } : undefined,
    ),

  addPaymentInfo: (p: { value: number; currency: string; method: string }, eventID?: string) =>
    fbTrack(
      'AddPaymentInfo',
      {
        ...moneyFields(p.value, p.currency),
        payment_method: p.method,
      },
      eventID ? { eventID } : undefined,
    ),

  /** Purchase — pass the order id as `eventID` so the browser event dedupes
   * against the server-side Conversions API Purchase. */
  purchase: (p: { orderId: string; value: number; currency: string; items: number }) =>
    fbTrack(
      'Purchase',
      { ...moneyFields(p.value, p.currency), num_items: p.items, content_type: 'product' },
      { eventID: p.orderId },
    ),

  subscribe: (p?: { value?: number; currency?: string }, eventID?: string) =>
    fbTrack('Subscribe', moneyFields(p?.value, p?.currency), eventID ? { eventID } : undefined),

  /** Attach Advanced Matching (raw email/phone) to lift Event Match Quality. */
  identify: (user: { email?: string | null; phone?: string | null }) => fbIdentify(user),

  contact: (eventID?: string) => fbTrack('Contact', undefined, eventID ? { eventID } : undefined),

  lead: (p?: { content_name?: string }, eventID?: string) =>
    fbTrack('Lead', p ? { content_name: p.content_name } : {}, eventID ? { eventID } : undefined),

  search: (query: string, eventID?: string) =>
    fbTrack('Search', { search_string: query }, eventID ? { eventID } : undefined),

  // Store-specific custom events (build Custom Conversions on these in Ads Manager).
  couponApplied: (code: string) => fbTrackCustom('CouponApplied', { coupon: code }),
  backInStockNotify: (productId: string) =>
    fbTrackCustom('BackInStockNotify', { content_ids: [productId], content_type: 'product' }),
  skincareAssistant: () => fbTrackCustom('SkincareAssistant'),
};
