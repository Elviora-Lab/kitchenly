'use client';

import { useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  linkSupplierVariant,
  unlinkSupplierVariant,
} from '@/server/actions/admin/purchasing.actions';

export function SupplierPriceForm({ supplierId }: { supplierId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    const text = (key: string) => String(formData.get(key) ?? '').trim() || undefined;
    const cost = text('unitCost');
    const moq = text('minOrderQuantity');

    start(async () => {
      const result = await linkSupplierVariant({
        supplierId,
        ourSku: String(formData.get('ourSku') ?? '').trim(),
        supplierSku: text('supplierSku'),
        unitCost: cost === undefined ? undefined : Number(cost),
        minOrderQuantity: moq === undefined ? undefined : Number(moq),
        isPreferred: formData.get('isPreferred') === 'on',
      });

      if (result.success) {
        toast.success('Price saved');
        formRef.current?.reset();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="grid items-end gap-3 md:grid-cols-5">
      <div className="flex flex-col gap-1.5">
        <Label>Our SKU</Label>
        <Input name="ourSku" required placeholder="ELV-SER-VC-001-30" className="h-9" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Their SKU</Label>
        <Input name="supplierSku" className="h-9" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Unit cost</Label>
        <Input name="unitCost" type="number" step="0.01" min="0" className="h-9" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Min order</Label>
        <Input name="minOrderQuantity" type="number" min="1" className="h-9" />
      </div>
      <div className="flex flex-col gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isPreferred"
            className="size-4 rounded border-border accent-foreground"
          />
          Preferred
        </label>
        <Button type="submit" size="sm" loading={pending}>
          Save price
        </Button>
      </div>
    </form>
  );
}

export function SupplierPriceRowActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await unlinkSupplierVariant({ id });
          if (result.success) {
            toast.success('Price removed');
            router.refresh();
          } else {
            toast.error(result.message);
          }
        })
      }
    >
      Remove
    </Button>
  );
}
