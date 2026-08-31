'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OrderStatus } from '@prisma/client';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
import { formatDate, formatMoney } from '@/utils/format';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  bulkBookWithPostEx,
  bulkUpdateOrderStatus,
  getPostExTrackingForOrders,
} from '@/server/actions/admin/orders.actions';

type Row = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  orderStatus: OrderStatus;
  paymentStatus: string;
  itemCount: number;
  totalAmount: number;
  currency: string;
  createdAt: Date;
};

const STATUS_VALUES = Object.values(OrderStatus);

export function OrdersTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('CONFIRMED');
  const [pending, start] = useTransition();

  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );
  const someSelected = selected.size > 0 && !allSelected;
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set());
  }

  function applyBulkStatus() {
    if (selectedIds.length === 0) return;
    const noun = `${selectedIds.length} order${selectedIds.length === 1 ? '' : 's'}`;
    if (!confirm(`Set ${noun} → ${bulkStatus}?`)) return;
    start(async () => {
      const result = await bulkUpdateOrderStatus({
        orderIds: selectedIds,
        status: bulkStatus,
      });
      if (result.success) {
        toast.success(`${result.data.updated} of ${result.data.requested} → ${bulkStatus}`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function printSelected() {
    if (selectedIds.length === 0) return;
    const ids = selectedIds.join(',');
    window.open(`/admin/orders/labels?ids=${encodeURIComponent(ids)}`, '_blank');
  }

  function bookSelectedWithPostEx() {
    if (selectedIds.length === 0) return;
    const noun = `${selectedIds.length} order${selectedIds.length === 1 ? '' : 's'}`;
    if (!confirm(`Book ${noun} with PostEx? Status will move to PROCESSING.`)) return;
    start(async () => {
      const result = await bulkBookWithPostEx({ orderIds: selectedIds });
      if (result.success) {
        const { booked, failed, errors } = result.data;
        if (booked > 0) toast.success(`Booked ${booked} with PostEx`);
        if (failed > 0) {
          toast.error(
            `${failed} failed${errors[0] ? `: ${errors[0].message}` : ''}${failed > 1 ? '…' : ''}`,
          );
        }
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function printSelectedPostExLabels() {
    if (selectedIds.length === 0) return;
    start(async () => {
      const result = await getPostExTrackingForOrders({ orderIds: selectedIds });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      const { trackingNumbers, missing } = result.data;
      if (trackingNumbers.length === 0) {
        toast.error('No PostEx tracking numbers on the selected orders — book first');
        return;
      }
      if (missing > 0) {
        toast.message(`${missing} selected order(s) have no PostEx booking yet`);
      }
      // PostEx accepts max 10 tracking numbers per invoice request.
      for (let i = 0; i < trackingNumbers.length; i += 10) {
        const chunk = trackingNumbers.slice(i, i + 10);
        window.open(
          `/api/v1/admin/postex/label?tracking=${encodeURIComponent(chunk.join(','))}`,
          '_blank',
          'noopener,noreferrer',
        );
      }
    });
  }

  if (rows.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        No orders match this filter.
      </div>
    );
  }

  return (
    <>
      {/* Bulk-action bar — only visible when something is selected. */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 transition-all',
          selectedIds.length === 0 && 'hidden',
        )}
      >
        <span className="text-sm font-medium">{selectedIds.length} selected</span>

        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Status →
          </label>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={applyBulkStatus} loading={pending}>
            Apply
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={bookSelectedWithPostEx} loading={pending}>
            Book PostEx ({selectedIds.length})
          </Button>
          <Button size="sm" variant="outline" onClick={printSelectedPostExLabels} loading={pending}>
            <Printer className="size-3.5" /> PostEx AWB ({selectedIds.length})
          </Button>
          <Button size="sm" variant="outline" onClick={printSelected}>
            <Printer className="size-3.5" /> Print labels ({selectedIds.length})
          </Button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      <table className="w-full min-w-[900px] text-sm">
        <thead className="border-b border-border">
          <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={(e) => toggleAll(e.target.checked)}
                aria-label="Select all orders on this page"
                className="size-4 cursor-pointer rounded border-border accent-foreground"
              />
            </th>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">Items</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Placed</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const checked = selected.has(o.id);
            return (
              <tr
                key={o.id}
                className={cn(
                  'border-b border-border/60 transition-colors last:border-b-0',
                  checked && 'bg-muted/30',
                )}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggleOne(o.id, e.target.checked)}
                    aria-label={`Select ${o.orderNumber}`}
                    className="size-4 cursor-pointer rounded border-border accent-foreground"
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs">{o.orderNumber}</td>
                <td className="px-4 py-3">
                  {o.customerName || o.customerEmail || o.customerPhone ? (
                    <>
                      {o.customerName ? <div className="font-medium">{o.customerName}</div> : null}
                      <div className="text-xs text-muted-foreground">
                        {o.customerEmail ?? o.customerPhone}
                      </div>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="muted">{o.orderStatus}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={o.paymentStatus === 'PAID' ? 'success' : 'muted'}>
                    {o.paymentStatus}
                  </Badge>
                </td>
                <td className="px-4 py-3">{o.itemCount}</td>
                <td className="px-4 py-3">{formatMoney(o.totalAmount, o.currency)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
