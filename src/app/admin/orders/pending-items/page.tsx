import Link from 'next/link';
import { type OrderStatus } from '@prisma/client';
import { z } from 'zod';

import { cn } from '@/lib/cn';
import { buildMetadata } from '@/lib/seo/metadata';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { ProductCell } from './product-cell';

import { adminOrdersRepo } from '@/server/repositories/admin.repo';

export const metadata = buildMetadata({ title: 'Admin · Pending items', noIndex: true });
export const dynamic = 'force-dynamic';

/** Statuses that still need packing. Terminal states never appear here. */
const OPEN_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
] as const satisfies readonly OrderStatus[];

const VIEWS = ['pick', 'orders'] as const;

const filterSchema = z.object({
  status: z.enum(OPEN_STATUSES).optional(),
  view: z.enum(VIEWS).optional(),
});

type Props = { searchParams: Promise<{ status?: string; view?: string }> };

export default async function AdminPendingItemsPage({ searchParams }: Props) {
  const raw = await searchParams;
  const { status, view: rawView } = filterSchema.parse({
    status: raw.status,
    view: raw.view,
  });
  // Default: PENDING only — every checkout starts there.
  const statuses: OrderStatus[] = status ? [status] : ['PENDING'];
  const view = rawView ?? 'pick';
  const pickHref = status
    ? `/admin/orders/pending-items?status=${status}`
    : '/admin/orders/pending-items';
  const ordersHref = status
    ? `/admin/orders/pending-items?status=${status}&view=orders`
    : '/admin/orders/pending-items?view=orders';

  const { aggregated, orders } = await adminOrdersRepo.pendingItems(statuses);

  const totalUnits = aggregated.reduce((sum, row) => sum + row.totalQuantity, 0);
  const uniqueSkus = aggregated.length;
  const statusLabel = status ? status.toLowerCase() : 'pending';

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/orders"
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          ← Orders
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="editorial-heading text-display-md">Pending items</h1>
            <p className="text-sm text-muted-foreground">
              What still needs packing from {statusLabel} orders.
            </p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/admin/orders?status=${status ?? 'PENDING'}`}>Open orders →</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Units to pack" value={totalUnits.toLocaleString()} />
        <Stat label="Distinct lines" value={uniqueSkus.toLocaleString()} />
        <Stat label="Orders" value={orders.length.toLocaleString()} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip
            href={`/admin/orders/pending-items${view === 'orders' ? '?view=orders' : ''}`}
            active={!status}
            label="Pending"
          />
          {OPEN_STATUSES.filter((s) => s !== 'PENDING').map((s) => (
            <FilterChip
              key={s}
              href={`/admin/orders/pending-items?status=${s}${view === 'orders' ? '&view=orders' : ''}`}
              active={status === s}
              label={s.charAt(0) + s.slice(1).toLowerCase()}
            />
          ))}
        </div>

        <div
          role="tablist"
          aria-label="Pending items view"
          className="inline-flex h-10 items-center gap-1 rounded-md bg-muted p-1"
        >
          <ViewTab href={pickHref} active={view === 'pick'} label={`Pick list (${uniqueSkus})`} />
          <ViewTab
            href={ordersHref}
            active={view === 'orders'}
            label={`By order (${orders.length})`}
          />
        </div>
      </div>

      {view === 'pick' ? (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 z-[1] border-b border-border bg-card">
                <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                </tr>
              </thead>
              <tbody>
                {aggregated.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-12 text-center text-muted-foreground">
                      Nothing to pack for {statusLabel} orders.
                    </td>
                  </tr>
                ) : (
                  aggregated.map((row) => (
                    <tr
                      key={`${row.variantId ?? row.productId ?? row.productName}|${row.variantName ?? ''}`}
                      className="border-b border-border/60 last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <ProductCell
                          productName={row.productName}
                          productSlug={row.productSlug}
                          imageUrl={row.imageUrl}
                          sku={row.sku}
                          variantName={row.variantName}
                          size={row.size}
                          shade={row.shade}
                          fragrance={row.fragrance}
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-base font-medium tabular-nums">
                        {row.totalQuantity}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.orderCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No matching orders.
              </CardContent>
            </Card>
          ) : (
            orders.map((order) => {
              const nameFromUser = [order.user?.firstName, order.user?.lastName]
                .filter(Boolean)
                .join(' ')
                .trim();
              const customer = order.shippingFullName || nameFromUser || order.user?.email || '—';
              const units = order.items.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <Card key={order.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-mono text-sm font-medium hover:underline"
                        >
                          {order.orderNumber}
                        </Link>
                        <span className="text-sm">{customer}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {order.shippingCity ? <span>{order.shippingCity}</span> : null}
                        {order.shippingPhone ? (
                          <a href={`tel:${order.shippingPhone}`} className="hover:text-foreground">
                            {order.shippingPhone}
                          </a>
                        ) : null}
                        <span>{order.createdAt.toLocaleString('en-PK')}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge>{order.orderStatus}</Badge>
                      <Badge muted>{order.paymentStatus}</Badge>
                      <span className="tabular-nums text-muted-foreground">
                        {units} unit{units === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full min-w-[520px] text-sm">
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.id} className="border-b border-border/60 last:border-b-0">
                            <td className="px-4 py-3">
                              <ProductCell
                                productName={item.productName}
                                productSlug={item.productSlug}
                                imageUrl={item.imageUrl}
                                sku={item.sku}
                                variantName={item.variantName}
                                size={item.size}
                                shade={item.shade}
                                fragrance={item.fragrance}
                                compact
                              />
                            </td>
                            <td className="px-4 py-3 text-right text-base font-medium tabular-nums">
                              ×{item.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-light tabular-nums">{value}</div>
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'border border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}

function ViewTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1.5 text-xs uppercase tracking-[0.12em] transition-all',
        active
          ? 'bg-background text-foreground shadow-soft'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}

function Badge({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full border border-border px-2 py-0.5 uppercase tracking-[0.1em]',
        muted ? 'text-muted-foreground' : 'bg-muted/50 text-foreground',
      )}
    >
      {children}
    </span>
  );
}
