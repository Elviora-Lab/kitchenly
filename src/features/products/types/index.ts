import type { ProductListSort as SortValue } from '@/lib/products/sort';

import type { ProductCardData } from '@/design-system/patterns/product-card';

export type ProductVariant = {
  id: string;
  sku: string;
  optionLabel: string; // e.g. "30ml", "Rose"
  price: number;
  compareAt?: number;
  inStock: boolean;
  imageUrl?: string;
};

export type Ingredient = {
  name: string;
  description?: string;
  isKey?: boolean;
};

export type Product = ProductCardData & {
  description: string;
  longDescription?: string;
  benefits: string[];
  howToUse?: string;
  ingredients: Ingredient[];
  variants: ProductVariant[];
  images: { url: string; alt: string }[];
  categoryIds: string[];
  tags: string[];
  skinTypes?: Array<'oily' | 'dry' | 'normal' | 'combination' | 'sensitive'>;
  concerns?: string[];
  updatedAt: string;
};

export type ProductListQuery = {
  page?: number;
  pageSize?: number;
  category?: string;
  q?: string;
  sort?: SortValue;
  priceMin?: number;
  priceMax?: number;
  skinType?: string;
  concern?: string;
  tag?: string;
};
