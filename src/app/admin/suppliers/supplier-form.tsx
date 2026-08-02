'use client';

import { useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { createSupplier } from '@/server/actions/admin/purchasing.actions';

export function SupplierForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(formData: FormData) {
    const text = (key: string) => String(formData.get(key) ?? '').trim() || undefined;
    const leadTime = text('leadTimeDays');

    start(async () => {
      const result = await createSupplier({
        name: String(formData.get('name') ?? ''),
        contactName: text('contactName'),
        email: text('email'),
        phone: text('phone'),
        address: text('address'),
        paymentTerms: text('paymentTerms'),
        leadTimeDays: leadTime === undefined ? undefined : Number(leadTime),
        notes: text('notes'),
        isActive: formData.get('isActive') === 'on',
      });

      if (result.success) {
        toast.success('Supplier added');
        formRef.current?.reset();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label>Name</Label>
        <Input name="name" required placeholder="SM Traders" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Contact person</Label>
        <Input name="contactName" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Email</Label>
        <Input name="email" type="email" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Phone</Label>
        <Input name="phone" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Payment terms</Label>
        <Input name="paymentTerms" placeholder="Net 30" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Lead time (days)</Label>
        <Input name="leadTimeDays" type="number" min="0" max="365" placeholder="7" />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label>Address</Label>
        <Input name="address" />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label>Notes</Label>
        <Input
          name="notes"
          placeholder="Minimum order, delivery days, anything worth remembering"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked
          className="size-4 rounded border-border accent-foreground"
        />
        Active (can be selected on new purchase orders)
      </label>
      <div className="md:col-span-2">
        <Button type="submit" loading={pending}>
          Add supplier
        </Button>
      </div>
    </form>
  );
}
