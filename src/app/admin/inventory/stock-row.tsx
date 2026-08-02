'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { formatMoney } from '@/utils/format';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  adjustStock,
  getStockHistory,
  setReorderRule,
  setStockLevel,
} from '@/server/actions/admin/inventory.actions';

type Variant = {
  id: string;
  sku: string;
  productName: string;
  descriptor: string;
  stockQuantity: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  avgCost: number | null;
};

type Movement = {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  note: string | null;
  unitCost: number | null;
  createdAt: string;
  actor: string | null;
};

const REASONS = [
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'DAMAGE', label: 'Damaged' },
  { value: 'LOSS', label: 'Lost / stolen' },
  { value: 'SUPPLIER_RETURN', label: 'Returned to supplier' },
] as const;

export function StockRow({
  variant,
  defaultThreshold,
}: {
  variant: Variant;
  defaultThreshold: number;
}) {
  const [open, setOpen] = useState(false);
  const effectivePoint = variant.reorderPoint ?? defaultThreshold;
  const low = variant.stockQuantity <= effectivePoint;

  return (
    <>
      <tr className="border-b border-border/60">
        <td className="px-4 py-3">
          <div>{variant.productName}</div>
          {variant.descriptor ? (
            <div className="text-xs text-muted-foreground">{variant.descriptor}</div>
          ) : null}
        </td>
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{variant.sku}</td>
        <td className={`px-4 py-3 ${low ? 'font-medium text-destructive' : ''}`}>
          {variant.stockQuantity}
        </td>
        <td className="px-4 py-3 text-muted-foreground">
          {variant.reorderPoint ?? `${defaultThreshold} (default)`}
        </td>
        <td className="px-4 py-3 text-muted-foreground">{variant.reorderQuantity ?? '—'}</td>
        <td className="px-4 py-3">
          {variant.avgCost === null ? '—' : formatMoney(variant.avgCost)}
        </td>
        <td className="px-4 py-3">
          {variant.avgCost === null ? '—' : formatMoney(variant.avgCost * variant.stockQuantity)}
        </td>
        <td className="px-4 py-3 text-right">
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? 'Close' : 'Manage'}
          </Button>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-border/60 bg-muted/30">
          <td colSpan={8} className="px-4 py-5">
            <StockRowPanel variant={variant} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function StockRowPanel({ variant }: { variant: Variant }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [history, setHistory] = useState<Movement[] | null>(null);

  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<(typeof REASONS)[number]['value']>('ADJUSTMENT');
  const [note, setNote] = useState('');
  const [counted, setCounted] = useState('');
  const [reorderPoint, setReorderPoint] = useState(variant.reorderPoint?.toString() ?? '');
  const [reorderQuantity, setReorderQuantity] = useState(variant.reorderQuantity?.toString() ?? '');

  const after = <T,>(result: { success: boolean; message?: string; data?: T }, ok: string) => {
    if (result.success) {
      toast.success(ok);
      setHistory(null);
      router.refresh();
    } else {
      toast.error(result.message ?? 'Something went wrong');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Adjust</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`delta-${variant.id}`}>Change (+ or −)</Label>
          <Input
            id={`delta-${variant.id}`}
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="-3"
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`reason-${variant.id}`}>Reason</Label>
          <select
            id={`reason-${variant.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`note-${variant.id}`}>Note</Label>
          <Input
            id={`note-${variant.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-9"
          />
        </div>
        <Button
          size="sm"
          loading={pending}
          disabled={!delta || Number(delta) === 0}
          onClick={() =>
            start(async () =>
              after(
                await adjustStock({
                  variantId: variant.id,
                  delta: Number(delta),
                  reason,
                  note: note || undefined,
                }),
                'Stock adjusted',
              ),
            )
          }
        >
          Post adjustment
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Stock count</h3>
        <p className="text-xs text-muted-foreground">
          Enter what you counted. The difference against {variant.stockQuantity} is posted as an
          adjustment, so the history still explains the change.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`count-${variant.id}`}>Counted quantity</Label>
          <Input
            id={`count-${variant.id}`}
            type="number"
            min="0"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            className="h-9"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          loading={pending}
          disabled={counted === ''}
          onClick={() =>
            start(async () =>
              after(
                await setStockLevel({ variantId: variant.id, quantity: Number(counted) }),
                'Count recorded',
              ),
            )
          }
        >
          Record count
        </Button>

        <h3 className="mt-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">
          Reorder rule
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`rp-${variant.id}`}>Reorder at</Label>
            <Input
              id={`rp-${variant.id}`}
              type="number"
              min="0"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
              placeholder="default"
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`rq-${variant.id}`}>Order qty</Label>
            <Input
              id={`rq-${variant.id}`}
              type="number"
              min="1"
              value={reorderQuantity}
              onChange={(e) => setReorderQuantity(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          loading={pending}
          onClick={() =>
            start(async () =>
              after(
                await setReorderRule({
                  variantId: variant.id,
                  reorderPoint: reorderPoint === '' ? null : Number(reorderPoint),
                  reorderQuantity: reorderQuantity === '' ? null : Number(reorderQuantity),
                }),
                'Reorder rule saved',
              ),
            )
          }
        >
          Save rule
        </Button>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-[0.12em] text-muted-foreground">History</h3>
        {history === null ? (
          <Button
            size="sm"
            variant="outline"
            loading={pending}
            onClick={() =>
              start(async () => {
                const result = await getStockHistory({ variantId: variant.id });
                if (result.success) setHistory(result.data);
                else toast.error(result.message);
              })
            }
          >
            Load movements
          </Button>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No movements recorded.</p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-2 text-xs">
            {history.map((m) => (
              <li key={m.id} className="border-b border-border/60 pb-2 last:border-b-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={m.delta > 0 ? 'text-emerald-600' : 'text-destructive'}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </span>
                  <span className="text-muted-foreground">→ {m.balanceAfter}</span>
                </div>
                <div className="text-muted-foreground">
                  {m.reason.toLowerCase().replace(/_/g, ' ')}
                  {m.unitCost === null ? '' : ` · ${formatMoney(m.unitCost)}`}
                </div>
                <div className="text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString('en-PK')}
                  {m.actor ? ` · ${m.actor}` : ''}
                </div>
                {m.note ? <div className="text-muted-foreground">{m.note}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
