'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { createCoupon } from '@/server/actions/admin/coupons.actions';

export function CouponForm() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    const num = (k: string) => {
      const v = formData.get(k);
      return v ? Number(v) : undefined;
    };
    const str = (k: string) => {
      const v = String(formData.get(k) ?? '');
      return v || undefined;
    };

    start(async () => {
      const res = await createCoupon({
        code: String(formData.get('code') ?? ''),
        discountType: String(formData.get('discountType') ?? 'PERCENTAGE') as
          | 'PERCENTAGE'
          | 'FIXED'
          | 'FREE_SHIPPING',
        discountValue: Number(formData.get('discountValue') ?? 0),
        minimumOrderAmount: num('minimumOrderAmount'),
        maximumDiscount: num('maximumDiscount'),
        usageLimit: num('usageLimit'),
        startsAt: str('startsAt'),
        expiresAt: str('expiresAt'),
        isActive: formData.get('isActive') === 'on',
      });
      if (res.success) {
        toast.success(`Coupon ${res.data.code} created`);
        router.refresh();
        (document.getElementById('coupon-form') as HTMLFormElement | null)?.reset();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <form id="coupon-form" action={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Code">
        <Input name="code" required placeholder="WELCOME10" />
      </Field>
      <Field label="Discount type">
        <select
          name="discountType"
          defaultValue="PERCENTAGE"
          className="h-11 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="PERCENTAGE">Percentage (%)</option>
          <option value="FIXED">Fixed amount</option>
          <option value="FREE_SHIPPING">Free shipping</option>
        </select>
      </Field>
      <Field label="Value (% or amount)">
        <Input name="discountValue" type="number" step="0.01" min="0" required defaultValue={10} />
      </Field>
      <Field label="Min order amount (optional)">
        <Input name="minimumOrderAmount" type="number" step="0.01" min="0" />
      </Field>
      <Field label="Max discount (optional, % caps)">
        <Input name="maximumDiscount" type="number" step="0.01" min="0" />
      </Field>
      <Field label="Usage limit (optional)">
        <Input name="usageLimit" type="number" min="1" placeholder="Unlimited" />
      </Field>
      <Field label="Starts at (optional)">
        <Input name="startsAt" type="datetime-local" />
      </Field>
      <Field label="Expires at (optional)">
        <Input name="expiresAt" type="datetime-local" />
      </Field>
      <p className="text-xs text-muted-foreground sm:col-span-2">Times use Pakistan store time.</p>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked
          className="size-4 accent-foreground"
        />
        Active
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          Create coupon
        </Button>
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
