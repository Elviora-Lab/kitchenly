import { createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '@/store';

export type CartLine = {
  /** Server-side cart_items.id — present when the line came from the DB.
   *  Optimistically-added lines (before server confirmation) won't have one. */
  id?: string;
  productId: string;
  variantId: string;
  slug: string;
  name: string;
  imageUrl: string;
  unitPrice: number;
  /** Pre-sale price — set only while a flash sale discounts this line. */
  originalPrice?: number;
  currency: string;
  quantity: number;
};

/** The flash sale discounting at least one line, for the cart countdown. */
export type CartFlashSale = { title: string; endsAt: string };

type CartState = {
  lines: CartLine[];
  couponCode: string | null;
  couponDiscount: number | null;
  shippingMethodId: string | null;
  flashSale: CartFlashSale | null;
};

const initialState: CartState = {
  lines: [],
  couponCode: null,
  couponDiscount: null,
  shippingMethodId: null,
  flashSale: null,
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addLine: (s, a: PayloadAction<CartLine>) => {
      const existing = s.lines.find(
        (l) => l.productId === a.payload.productId && l.variantId === a.payload.variantId,
      );
      if (existing) {
        existing.quantity += a.payload.quantity;
      } else {
        s.lines.push(a.payload);
      }
    },
    updateQuantity: (
      s,
      a: PayloadAction<{ productId: string; variantId: string; quantity: number }>,
    ) => {
      const line = s.lines.find(
        (l) => l.productId === a.payload.productId && l.variantId === a.payload.variantId,
      );
      if (!line) return;
      if (a.payload.quantity <= 0) {
        s.lines = s.lines.filter((l) => l !== line);
      } else {
        line.quantity = a.payload.quantity;
      }
    },
    removeLine: (s, a: PayloadAction<{ productId: string; variantId: string }>) => {
      s.lines = s.lines.filter(
        (l) => !(l.productId === a.payload.productId && l.variantId === a.payload.variantId),
      );
    },
    clearCart: (s) => {
      s.lines = [];
      s.couponCode = null;
      s.couponDiscount = null;
    },
    applyCoupon: (s, a: PayloadAction<{ code: string; discount: number }>) => {
      s.couponCode = a.payload.code;
      s.couponDiscount = a.payload.discount;
    },
    removeCoupon: (s) => {
      s.couponCode = null;
      s.couponDiscount = null;
    },
    setShippingMethod: (s, a: PayloadAction<string | null>) => {
      s.shippingMethodId = a.payload;
    },
    hydrate: (_, a: PayloadAction<CartState>) => a.payload,
  },
});

export const {
  addLine,
  updateQuantity,
  removeLine,
  clearCart,
  applyCoupon,
  removeCoupon,
  setShippingMethod,
  hydrate,
} = cartSlice.actions;

export const cartReducer = cartSlice.reducer;

// — Selectors —
export const selectCart = (s: RootState) => s.cart;
export const selectCartLines = (s: RootState) => s.cart.lines;
export const selectCartCount = createSelector(selectCartLines, (lines) =>
  lines.reduce((n, l) => n + l.quantity, 0),
);
export const selectCartSubtotal = createSelector(selectCartLines, (lines) =>
  lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
);
export const selectCartFlashSale = (s: RootState) => s.cart.flashSale;
/** Total saved on this cart by the live flash sale (0 when none applies). */
export const selectCartFlashSavings = createSelector(selectCartLines, (lines) =>
  lines.reduce(
    (sum, l) => sum + (l.originalPrice ? (l.originalPrice - l.unitPrice) * l.quantity : 0),
    0,
  ),
);
