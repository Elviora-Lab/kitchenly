'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { CategoryOptionGroup } from './category-options';
import { ImageUploader } from './image-uploader';

import {
  createProduct,
  deleteProduct,
  updateProduct,
} from '@/server/actions/admin/products.actions';

type Values = {
  id?: string;
  name: string;
  slug?: string;
  sku: string;
  shortDescription?: string;
  fullDescription?: string;
  price: number;
  comparePrice?: number;
  costPrice?: number;
  isFeatured?: boolean;
  isActive?: boolean;
  categoryId?: string | null;
  brandId?: string | null;
  images?: string[];
};

export type BrandOption = { id: string; name: string };

export function ProductForm({
  mode,
  defaultValues,
  categories = [],
  brands = [],
}: {
  mode: 'create' | 'edit';
  defaultValues?: Values;
  categories?: CategoryOptionGroup[];
  brands?: BrandOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [images, setImages] = useState<string[]>(defaultValues?.images ?? []);

  async function onSubmit(formData: FormData) {
    const payload: Values = {
      name: String(formData.get('name') ?? ''),
      slug: String(formData.get('slug') ?? '') || undefined,
      sku: String(formData.get('sku') ?? ''),
      shortDescription: String(formData.get('shortDescription') ?? '') || undefined,
      fullDescription: String(formData.get('fullDescription') ?? '') || undefined,
      price: Number(formData.get('price') ?? 0),
      comparePrice: formData.get('comparePrice') ? Number(formData.get('comparePrice')) : undefined,
      costPrice: formData.get('costPrice') ? Number(formData.get('costPrice')) : undefined,
      isFeatured: formData.get('isFeatured') === 'on',
      isActive: formData.get('isActive') === 'on',
      // Empty select value = "No category / brand" → null clears it server-side.
      categoryId: String(formData.get('categoryId') ?? '') || null,
      brandId: String(formData.get('brandId') ?? '') || null,
      images,
    };

    start(async () => {
      const result =
        mode === 'create'
          ? await createProduct(payload)
          : await updateProduct({ id: defaultValues!.id!, ...payload });

      if (result.success) {
        toast.success(mode === 'create' ? 'Product created' : 'Product updated');
        if (mode === 'create') {
          router.push('/admin/products');
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.message);
      }
    });
  }

  function onDelete() {
    if (!defaultValues?.id) return;
    if (!confirm('Delete this product? This cannot be undone.')) return;
    startDelete(async () => {
      const result = await deleteProduct({ id: defaultValues.id! });
      if (result.success) {
        toast.success('Product deleted');
        router.push('/admin/products');
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <Field label="Name">
        <Input name="name" required defaultValue={defaultValues?.name} />
      </Field>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="SKU">
          <Input name="sku" required defaultValue={defaultValues?.sku} />
        </Field>
        <Field label="Slug (auto from name when empty)">
          <Input name="slug" defaultValue={defaultValues?.slug} />
        </Field>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Category">
          <select
            name="categoryId"
            defaultValue={defaultValues?.categoryId ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3.5 py-2 text-sm focus-visible:border-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">— No category —</option>
            {categories.map((group) => (
              <optgroup key={group.id} label={group.name}>
                <option value={group.id}>All {group.name}</option>
                {group.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Brand">
          <select
            name="brandId"
            defaultValue={defaultValues?.brandId ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3.5 py-2 text-sm focus-visible:border-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">— No brand —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Short description">
        <Input name="shortDescription" defaultValue={defaultValues?.shortDescription} />
      </Field>

      <Field label="Full description">
        <textarea
          name="fullDescription"
          defaultValue={defaultValues?.fullDescription}
          rows={7}
          placeholder={
            '## How to use\n- Step one\n- Step two\n\n**Pro tip:** layer for extra hold.'
          }
          className="flex w-full rounded-md border border-input bg-transparent px-3.5 py-2 text-sm placeholder:text-muted-foreground/70 focus-visible:border-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Supports simple formatting: <code>## Heading</code>, <code>- bullet</code>,{' '}
          <code>1. numbered</code>, and <code>**bold**</code>. Leave a blank line between
          paragraphs.
        </p>
      </Field>

      <Field label="Product images">
        <ImageUploader value={images} onChange={setImages} />
      </Field>

      <div className="grid gap-5 md:grid-cols-3">
        <Field label="Price (PKR)">
          <Input
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={defaultValues?.price}
          />
        </Field>
        <Field label="Compare-at price">
          <Input
            name="comparePrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.comparePrice}
          />
        </Field>
        <Field label="Cost">
          <Input
            name="costPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultValues?.costPrice}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-6">
        <Checkbox
          name="isActive"
          label="Active (visible to customers)"
          defaultChecked={defaultValues?.isActive ?? true}
        />
        <Checkbox
          name="isFeatured"
          label="Featured"
          defaultChecked={defaultValues?.isFeatured ?? false}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex gap-3">
          <Button type="submit" loading={pending}>
            {mode === 'create' ? 'Create product' : 'Save changes'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
        {mode === 'edit' ? (
          <Button type="button" variant="destructive" onClick={onDelete} loading={deleting}>
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 rounded border-border accent-foreground"
      />
      {label}
    </label>
  );
}
