import { Suspense } from 'react';
import Link from 'next/link';
import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

import { buildMetadata } from '@/lib/seo/metadata';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { OrdersSearch } from './orders-search';
import { OrdersTable } from './orders-table';

import { adminOrdersRepo } from '@/server/repositories/admin.repo';

export const metadata = buildMetadata({ title: 'Admin · Orders', noIndex: true });
export const dynamic = 'force-dynamic';

const statusValues = Object.values(OrderStatus);
const filterSchema = z.object({
  status: z.enum(statusValues as [OrderStatus, ...OrderStatus[]]).optional(),
  q: z.string().trim().max(120).optional(),
});

type Props = { searchParams: Promise<{ status?: string; q?: string }> };

function statusHref(status?: OrderStatus, q?: string) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const qs = params.toString();
  return qs ? `/admin/orders?${qs}` : '/admin/orders';
}

export default async function AdminOrdersPage({ searchParams }: Props) {
  const raw = await searchParams;
  const { status, q } = filterSchema.parse({ status: raw.status, q: raw.q });

  const [items, total] = await adminOrdersRepo.list({ status, q, take: 100 });

  // Project the Prisma rows to a plain client-safe shape.
  const rows = items.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    // Guest checkouts have no linked account, so fall back to the order's own
    // shipping snapshot — otherwise every guest order showed a bare "—" and was
    // unidentifiable without opening it.
    customerName:
      o.shippingFullName ??
      ([o.user?.firstName, o.user?.lastName].filter(Boolean).join(' ').trim() || null),
    customerEmail: o.user?.email ?? o.shippingEmail ?? null,
    customerPhone: o.shippingPhone ?? null,
    orderStatus: o.orderStatus,
    paymentStatus: o.paymentStatus,
    shipment: o.shipments[0]
      ? {
          courierName: o.shipments[0].courierName,
          trackingNumber: o.shipments[0].trackingNumber,
          shipmentStatus: o.shipments[0].shipmentStatus,
          trackingStatusText: o.shipments[0].trackingStatusText,
          trackingJourney: o.shipments[0].trackingJourney,
          trackingSyncedAt: o.shipments[0].trackingSyncedAt,
        }
      : null,
    itemCount: o._count.items,
    totalAmount: Number(o.totalAmount),
    currency: o.currency,
    createdAt: o.createdAt,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="editorial-heading text-display-md">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {total} matching — track status, fulfilment, refunds.
          </p>
        </div>
        <Link
          href="/admin/orders/pending-items"
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Pending items →
        </Link>
      </header>

      <Suspense fallback={null}>
        <OrdersSearch />
      </Suspense>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={!status ? 'primary' : 'outline'}>
          <Link href={statusHref(undefined, q)}>All</Link>
        </Button>
        {statusValues.map((s) => (
          <Button key={s} asChild size="sm" variant={status === s ? 'primary' : 'outline'}>
            <Link href={statusHref(s, q)}>{s}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <OrdersTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
