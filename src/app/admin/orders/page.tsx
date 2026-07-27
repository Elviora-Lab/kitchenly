import Link from 'next/link';
import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

import { buildMetadata } from '@/lib/seo/metadata';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { OrdersTable } from './orders-table';

import { adminOrdersRepo } from '@/server/repositories/admin.repo';

export const metadata = buildMetadata({ title: 'Admin · Orders', noIndex: true });
export const dynamic = 'force-dynamic';

const statusValues = Object.values(OrderStatus);
const filterSchema = z.object({
  status: z.enum(statusValues as [OrderStatus, ...OrderStatus[]]).optional(),
});

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminOrdersPage({ searchParams }: Props) {
  const raw = await searchParams;
  const { status } = filterSchema.parse({ status: raw.status });

  const [items, total] = await adminOrdersRepo.list({ status, take: 100 });

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
    itemCount: o._count.items,
    totalAmount: Number(o.totalAmount),
    currency: o.currency,
    createdAt: o.createdAt,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="editorial-heading text-display-md">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {total} matching — track status, fulfilment, refunds.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={!status ? 'primary' : 'outline'}>
          <Link href="/admin/orders">All</Link>
        </Button>
        {statusValues.map((s) => (
          <Button key={s} asChild size="sm" variant={status === s ? 'primary' : 'outline'}>
            <Link href={`/admin/orders?status=${s}`}>{s}</Link>
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
