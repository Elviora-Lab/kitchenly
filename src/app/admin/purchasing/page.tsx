import Link from 'next/link';
import { type PurchaseOrderStatus } from '@prisma/client';

import { buildMetadata } from '@/lib/seo/metadata';
import { formatMoney } from '@/utils/format';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { PurchaseOrderForm } from './purchase-order-form';

import { purchaseOrdersRepo, suppliersRepo } from '@/server/repositories/purchasing.repo';

export const metadata = buildMetadata({ title: 'Admin · Purchasing', noIndex: true });
export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting delivery',
  PARTIALLY_RECEIVED: 'Part delivered',
  RECEIVED: 'Complete',
  CANCELLED: 'Cancelled',
};

export default async function AdminPurchasingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page: rawPage } = await searchParams;
  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = 25;

  const validStatus =
    status && status in STATUS_LABEL ? (status as PurchaseOrderStatus) : undefined;

  const [{ items, total }, suppliers] = await Promise.all([
    purchaseOrdersRepo.list({ status: validStatus, skip: (page - 1) * pageSize, take: pageSize }),
    suppliersRepo.listActive(),
  ]);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <header>
        <h1 className="editorial-heading text-display-md">Purchasing</h1>
        <p className="text-sm text-muted-foreground">
          Orders placed with suppliers. Receiving a delivery credits stock and updates each
          item&rsquo;s average cost, including its share of shipping and duty.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Raise a purchase order</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a supplier first —{' '}
              <Link href="/admin/suppliers" className="underline">
                Suppliers
              </Link>
              .
            </p>
          ) : (
            <PurchaseOrderForm suppliers={suppliers} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>Orders</CardTitle>
          <nav className="flex flex-wrap gap-2 text-xs">
            <StatusLink current={status} value={undefined} label="All" />
            {(Object.keys(STATUS_LABEL) as PurchaseOrderStatus[]).map((key) => (
              <StatusLink key={key} current={status} value={key} label={STATUS_LABEL[key]} />
            ))}
          </nav>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Lines</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Order value</th>
                <th className="px-4 py-3">Expected</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No purchase orders here.
                  </td>
                </tr>
              ) : (
                items.map((po) => {
                  const ordered = po.items.reduce((sum, i) => sum + i.quantityOrdered, 0);
                  const received = po.items.reduce((sum, i) => sum + i.quantityReceived, 0);
                  const value = po.items.reduce(
                    (sum, i) => sum + Number(i.unitCost) * i.quantityOrdered,
                    0,
                  );

                  return (
                    <tr key={po.id} className="border-b border-border/60 last:border-b-0">
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link href={`/admin/purchasing/${po.id}`} className="hover:underline">
                          {po.poNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{po.supplier.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{STATUS_LABEL[po.status]}</td>
                      <td className="px-4 py-3">{po.items.length}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {received} / {ordered}
                      </td>
                      <td className="px-4 py-3">{formatMoney(value, po.currency)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {po.expectedAt ? po.expectedAt.toLocaleDateString('en-PK') : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {total > pageSize ? (
        <p className="text-xs text-muted-foreground">
          Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
        </p>
      ) : null}
    </div>
  );
}

function StatusLink({
  current,
  value,
  label,
}: {
  current?: string;
  value?: PurchaseOrderStatus;
  label: string;
}) {
  const active = current === value || (!current && !value);
  const href = value ? `/admin/purchasing?status=${value}` : '/admin/purchasing';

  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-foreground px-3 py-1 text-background'
          : 'rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground'
      }
    >
      {label}
    </Link>
  );
}
