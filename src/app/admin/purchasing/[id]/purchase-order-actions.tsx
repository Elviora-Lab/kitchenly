'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { type PurchaseOrderStatus } from '@prisma/client';
import { toast } from 'sonner';

import { formatMoney } from '@/utils/format';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  cancelPurchaseOrder,
  deletePurchaseOrder,
  receivePurchaseOrder,
  submitPurchaseOrder,
} from '@/server/actions/admin/purchasing.actions';

export function PurchaseOrderActions({ id, status }: { id: string; status: PurchaseOrderStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (status === 'RECEIVED' || status === 'CANCELLED') return null;

  const run = (
    action: (input: { id: string }) => Promise<{ success: boolean; message?: string }>,
    successMessage: string,
    redirect?: string,
  ) =>
    start(async () => {
      const result = await action({ id });
      if (result.success) {
        toast.success(successMessage);
        if (redirect) router.push(redirect);
        else router.refresh();
      } else {
        toast.error(result.message ?? 'Something went wrong');
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'DRAFT' ? (
        <>
          <Button
            size="sm"
            loading={pending}
            onClick={() => run(submitPurchaseOrder, 'Order submitted')}
          >
            Submit to supplier
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={pending}
            onClick={() => run(deletePurchaseOrder, 'Draft deleted', '/admin/purchasing')}
          >
            Delete draft
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          loading={pending}
          onClick={() => run(cancelPurchaseOrder, 'Order cancelled')}
        >
          Cancel order
        </Button>
      )}
    </div>
  );
}

type ReceiveLine = {
  id: string;
  label: string;
  outstanding: number;
  landedCost: number;
};

export function ReceiveForm({
  purchaseOrderId,
  currency,
  lines,
}: {
  purchaseOrderId: string;
  currency: string;
  lines: ReceiveLine[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  function onSubmit() {
    const payload = lines
      .map((line) => ({
        purchaseOrderItemId: line.id,
        quantity: Number(quantities[line.id] ?? 0) || 0,
      }))
      .filter((line) => line.quantity > 0);

    if (payload.length === 0) {
      toast.error('Enter a quantity for at least one line');
      return;
    }

    start(async () => {
      const result = await receivePurchaseOrder({
        purchaseOrderId,
        lines: payload,
        note: note || undefined,
      });

      if (result.success) {
        toast.success(
          result.data.status === 'RECEIVED'
            ? 'Delivery booked in — order complete'
            : 'Delivery booked in',
        );
        setQuantities({});
        setNote('');
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Enter what actually arrived. Stock is credited at the landed cost shown, which rolls into
        each item&rsquo;s average cost.
      </p>

      <div className="flex flex-col gap-3">
        {lines.map((line) => (
          <div key={line.id} className="grid items-center gap-3 md:grid-cols-[2fr_auto_auto]">
            <div>
              <div className="text-sm">{line.label}</div>
              <div className="text-xs text-muted-foreground">
                {line.outstanding} outstanding · {formatMoney(line.landedCost, currency)} landed
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setQuantities((c) => ({ ...c, [line.id]: String(line.outstanding) }))}
            >
              All
            </Button>
            <Input
              type="number"
              min="0"
              max={line.outstanding}
              placeholder="0"
              value={quantities[line.id] ?? ''}
              onChange={(e) => setQuantities((c) => ({ ...c, [line.id]: e.target.value }))}
              className="h-9 w-28"
              aria-label={`Quantity received for ${line.label}`}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="receipt-note">Note</Label>
        <Input
          id="receipt-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Delivery note number, condition on arrival…"
        />
      </div>

      <div>
        <Button type="button" onClick={onSubmit} loading={pending}>
          Book in delivery
        </Button>
      </div>
    </div>
  );
}
