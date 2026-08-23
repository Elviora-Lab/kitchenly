import { z } from 'zod';

import { PRODUCT_SORT_VALUES } from '@/lib/products/sort';

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  category: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(PRODUCT_SORT_VALUES).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  skinType: z.string().optional(),
  concern: z.string().optional(),
  tag: z.string().optional(),
});

export type ProductListQueryInput = z.infer<typeof productListQuerySchema>;
