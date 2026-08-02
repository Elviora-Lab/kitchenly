'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import { formatMoney } from '@/utils/format';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  createPurchaseOrder,
  lookupSupplierPrice,
} from '@/server/actions/admin/purchasing.actions';

type SupplierOption = {
  id: string;
  name: string;
  leadTimeDays: number | null;
  paymentTerms: string | null;
};

type Line = {
  key: number;
  ourSku: string;
  quantityOrdered: string;
  unitCost: string;
  /** Filled in by the supplier-price lookup, purely to reassure the buyer. */
  hint?: string;
};

const blankLine = (key: number): Line => ({ key, ourSku: '', quantityOrdered: '', unitCost: '' });

export function PurchaseOrderForm({ suppliers }: { suppliers: SupplierOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [expectedAt, setExpectedAt] = useState('');
  const [notes, setNotes] = useState('');
  const [shippingCost, setShippingCost] = useState('');
  const [dutyCost, setDutyCost] = useState('');
  const [otherCost, setOtherCost] = useState('');
  const [lines, setLines] = useState<Line[]>([blankLine(0)]);

  const setLine = (key: number, patch: Partial<Line>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const lineValue = lines.reduce(
    (sum, l) => sum + (Number(l.quantityOrdered) || 0) * (Number(l.unitCost) || 0),
    0,
  );
  const charges = (Number(shippingCost) || 0) + (Number(dutyCost) || 0) + (Number(otherCost) || 0);

  /** Pull the supplier's quoted price the moment a SKU is entered. */
  async function onSkuBlur(line: Line) {
    if (!line.ourSku.trim() || !supplierId) return;

    const result = await lookupSupplierPrice({ supplierId, ourSku: line.ourSku.trim() });
    if (!result.success) {
      setLine(line.key, { hint: result.message });
      return;
    }

    const { productName, stockQuantity, unitCost, suggestedQuantity } = result.data;
    setLine(line.key, {
      hint: `${productName} · ${stockQuantity} on hand`,
      unitCost: line.unitCost || (unitCost === null ? '' : String(unitCost)),
      quantityOrdered:
        line.quantityOrdered || (suggestedQuantity === null ? '' : String(suggestedQuantity)),
    });
  }

  function onSubmit() {
    const items = lines
      .filter((l) => l.ourSku.trim() && Number(l.quantityOrdered) > 0)
      .map((l) => ({
        ourSku: l.ourSku.trim(),
        quantityOrdered: Number(l.quantityOrdered),
        unitCost: Number(l.unitCost) || 0,
      }));

    if (items.length === 0) {
      toast.error('Add at least one line with a SKU and quantity');
      return;
    }

    start(async () => {
      const result = await createPurchaseOrder({
        supplierId,
        expectedAt: expectedAt ? new Date(expectedAt) : undefined,
        notes: notes || undefined,
        shippingCost: Number(shippingCost) || undefined,
        dutyCost: Number(dutyCost) || undefined,
        otherCost: Number(otherCost) || undefined,
        items,
      });

      if (result.success) {
        toast.success(`Draft ${result.data.poNumber} created`);
        setLines([blankLine(0)]);
        setNotes('');
        setShippingCost('');
        setDutyCost('');
        setOtherCost('');
        router.push(`/admin/purchasing/${result.data.id}`);
      } else {
        toast.error(result.message);
      }
    });
  }

  const supplier = suppliers.find((s) => s.id === supplierId);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-supplier">Supplier</Label>
          <select
            id="po-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {supplier ? (
            <p className="text-xs text-muted-foreground">
              {supplier.paymentTerms ?? 'No terms recorded'}
              {supplier.leadTimeDays === null ? '' : ` · ${supplier.leadTimeDays} day lead time`}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-expected">Expected delivery</Label>
          <Input
            id="po-expected"
            type="date"
            value={expectedAt}
            onChange={(e) => setExpectedAt(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-notes">Notes</Label>
          <Input id="po-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Lines</Label>
        {lines.map((line) => (
          <div key={line.key} className="grid items-start gap-2 md:grid-cols-[2fr_1fr_1fr_auto]">
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Our SKU"
                value={line.ourSku}
                onChange={(e) => setLine(line.key, { ourSku: e.target.value })}
                onBlur={() => void onSkuBlur(line)}
                className="h-9"
              />
              {line.hint ? (
                <span className="text-xs text-muted-foreground">{line.hint}</span>
              ) : null}
            </div>
            <Input
              type="number"
              min="1"
              placeholder="Qty"
              value={line.quantityOrdered}
              onChange={(e) => setLine(line.key, { quantityOrdered: e.target.value })}
              className="h-9"
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Unit cost"
              value={line.unitCost}
              onChange={(e) => setLine(line.key, { unitCost: e.target.value })}
              className="h-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Remove line"
              disabled={lines.length === 1}
              onClick={() => setLines((c) => c.filter((l) => l.key !== line.key))}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLines((c) => [...c, blankLine(Date.now())])}
          >
            <Plus className="size-4" /> Add line
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-shipping">Shipping</Label>
          <Input
            id="po-shipping"
            type="number"
            min="0"
            step="0.01"
            value={shippingCost}
            onChange={(e) => setShippingCost(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-duty">Duty</Label>
          <Input
            id="po-duty"
            type="number"
            min="0"
            step="0.01"
            value={dutyCost}
            onChange={(e) => setDutyCost(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="po-other">Other charges</Label>
          <Input
            id="po-other"
            type="number"
            min="0"
            step="0.01"
            value={otherCost}
            onChange={(e) => setOtherCost(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
        <div className="text-muted-foreground">
          Lines {formatMoney(lineValue)} + charges {formatMoney(charges)}
        </div>
        <div className="font-medium">Total {formatMoney(lineValue + charges)}</div>
      </div>

      <div>
        <Button type="button" onClick={onSubmit} loading={pending}>
          Create draft
        </Button>
      </div>
    </div>
  );
}
