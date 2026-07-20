import { baseApi } from '@/services/api';

import type { CartFlashSale, CartLine } from '../store/cart-slice';

export type ServerCart = {
  id: string;
  lines: CartLine[];
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  couponCode: string | null;
  /** Set when the live flash sale discounts at least one line. */
  flashSale: CartFlashSale | null;
};

export const cartApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCart: builder.query<ServerCart, void>({
      query: () => '/cart',
      providesTags: ['Cart'],
    }),
    addToCart: builder.mutation<ServerCart, { variantId: string; quantity: number }>({
      query: (body) => ({ url: '/cart/lines', method: 'POST', body }),
      invalidatesTags: ['Cart'],
    }),
    updateCartLine: builder.mutation<ServerCart, { lineId: string; quantity: number }>({
      query: ({ lineId, quantity }) => ({
        url: `/cart/lines/${lineId}`,
        method: 'PATCH',
        body: { quantity },
      }),
      invalidatesTags: ['Cart'],
    }),
    removeCartLine: builder.mutation<ServerCart, { lineId: string }>({
      query: ({ lineId }) => ({ url: `/cart/lines/${lineId}`, method: 'DELETE' }),
      invalidatesTags: ['Cart'],
    }),
    applyCartCoupon: builder.mutation<ServerCart, { code: string }>({
      query: (body) => ({ url: '/cart/coupon', method: 'POST', body }),
      invalidatesTags: ['Cart'],
    }),
    clearCartCoupon: builder.mutation<ServerCart, void>({
      query: () => ({ url: '/cart/coupon', method: 'DELETE' }),
      invalidatesTags: ['Cart'],
    }),
  }),
});

export const {
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartLineMutation,
  useRemoveCartLineMutation,
  useApplyCartCouponMutation,
  useClearCartCouponMutation,
} = cartApi;
