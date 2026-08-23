import 'server-only';

import { z } from 'zod';

import { PRODUCT_SORT_VALUES } from '@/lib/products/sort';

import { paginationQuerySchema } from '@/server/http/pagination';

export const productListQuery = paginationQuerySchema.extend({
  category: z.string().max(180).optional(),
  brand: z.string().max(180).optional(),
  // Longest real product name is well under this; caps pathological inputs.
  q: z.string().trim().max(200).optional(),
  sort: z.enum(PRODUCT_SORT_VALUES).default('newly-added'),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  skinType: z.string().optional(),
  concern: z.string().optional(),
  tag: z.string().optional(),
});

export const productSlugParams = z.object({ slug: z.string().min(1) });

export type ProductListQuery = z.infer<typeof productListQuery>;
