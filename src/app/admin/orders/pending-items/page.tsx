import Link from 'next/link';
import { type OrderStatus } from '@prisma/client';
import { z } from 'zod';

import { buildMetadata } from '@/lib/seo/metadata';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { adminOrdersRepo } from '@/server/repositories/admin.repo';

export const metadata = buildMetadata({ title: 'Admin · Pending items', noIndex: true });
export const dynamic = 'force-dynamic';

/** Statuses that still need packing. Terminal states never appear here. */
const OPEN_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
] as const satisfies readonly OrderStatus[];

const filterSchema = z.object({
  status: z.enum(OPEN_STATUSES).optional(),
});

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminPendingItemsPage({ searchParams }: Props) {
  const raw = await searchParams;
  const { status } = filterSchema.parse({ status: raw.status });
  // Default: PENDING only — every checkout starts there. Use the chips to
  // widen to confirmed / processing when those also need packing.
  const statuses: OrderStatus[] = status ? [status] : ['PENDING'];

  const { aggregated, orders } = await adminOrdersRepo.pendingItems(statuses);

  const totalUnits = aggregated.reduce((sum, row) => sum + row.totalQuantity, 0);
  const uniqueSkus = aggregated.length;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/orders"
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          ← Orders
        </Link>
        <h1 className="editorial-heading text-display-md">Pending items</h1>
        <p className="text-sm text-muted-foreground">
          What still needs packing from {status ? status.toLowerCase() : 'pending'} orders —{' '}
          {totalUnits.toLocaleString()} units across {uniqueSkus.toLocaleString()} lines, from{' '}
          {orders.length.toLocaleString()} orders.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={!status ? 'primary' : 'outline'}>
          <Link href="/admin/orders/pending-items">PENDING</Link>
        </Button>
        {OPEN_STATUSES.filter((s) => s !== 'PENDING').map((s) => (
          <Button key={s} asChild size="sm" variant={status === s ? 'primary' : 'outline'}>
            <Link href={`/admin/orders/pending-items?status=${s}`}>{s}</Link>
          </Button>
        ))}
        <Button asChild size="sm" variant="outline">
          <Link href={`/admin/orders?status=${status ?? 'PENDING'}`}>View orders →</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pick list</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Qty needed</th>
                <th className="px-4 py-3">Orders</th>
              </tr>
            </thead>
            <tbody>
              {aggregated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Nothing to pack for {status ? status.toLowerCase() : 'pending'} orders.
                  </td>
                </tr>
              ) : (
                aggregated.map((row) => (
                  <tr
                    key={`${row.variantId ?? row.productId ?? row.productName}|${row.variantName ?? ''}`}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium">{row.productName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {displayVariant(row.variantName)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {row.sku ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.totalQuantity}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.orderCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By order</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No matching orders.</p>
          ) : (
            orders.map((order) => {
              const nameFromUser = [order.user?.firstName, order.user?.lastName]
                .filter(Boolean)
                .join(' ')
                .trim();
              const customer = order.shippingFullName || nameFromUser || order.user?.email || '—';
              const units = order.items.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <div key={order.id} className="rounded-md border border-border">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/30 px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-sm font-medium hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <span className="text-sm">{customer}</span>
                      {order.shippingCity ? (
                        <span className="text-xs text-muted-foreground">{order.shippingCity}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {units} unit{units === 1 ? '' : 's'} · {order.orderStatus} ·{' '}
                      {order.paymentStatus} · {order.createdAt.toLocaleString('en-PK')}
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {order.items.map((item) => (
                        <tr key={item.id} className="border-b border-border/60 last:border-b-0">
                          <td className="px-4 py-2.5">{item.productName}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {item.variant
                              ? [
                                  item.variant.size,
                                  shadeCode(item.variant.shade),
                                  item.variant.fragrance,
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || displayVariant(item.variantName)
                              : displayVariant(item.variantName)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                            {item.variant?.sku ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">×{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Strip the trailing `@#RRGGBB` shade encoding used in snapshots. */
function displayVariant(variantName: string | null): string {
  if (!variantName) return '—';
  return (
    variantName
      .split(' · ')
      .map((part) => part.replace(/@#[0-9A-Fa-f]{6}$/, ''))
      .filter(Boolean)
      .join(' · ') || '—'
  );
}

function shadeCode(shade: string | null | undefined): string | null {
  if (!shade) return null;
  return shade.replace(/@#[0-9A-Fa-f]{6}$/, '');
}
