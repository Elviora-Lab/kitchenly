import Link from 'next/link';
import { notFound } from 'next/navigation';

import { extraCharges, landedCostFactor, orderedValue, unitLandedCost } from '@/lib/purchasing';
import { buildMetadata } from '@/lib/seo/metadata';
import { formatMoney } from '@/utils/format';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { PurchaseOrderActions, ReceiveForm } from './purchase-order-actions';

import { purchaseOrdersRepo } from '@/server/repositories/purchasing.repo';

export const metadata = buildMetadata({ title: 'Admin · Purchase order', noIndex: true });
export const dynamic = 'force-dynamic';

export default async function AdminPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const po = await purchaseOrdersRepo.findById(id);
  if (!po) notFound();

  const linesValue = orderedValue(po.items);
  const charges = extraCharges(po);
  // Same factor the service will apply on receipt, shown up front so the buyer
  // can see what each unit will actually cost once shipping is spread over it.
  const factor = landedCostFactor(linesValue, charges);
  const receivable = po.status === 'SUBMITTED' || po.status === 'PARTIALLY_RECEIVED';
  const outstanding = po.items.filter((i) => i.quantityReceived < i.quantityOrdered);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/purchasing"
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          ← Purchasing
        </Link>
        <h1 className="editorial-heading text-display-md">{po.poNumber}</h1>
        <p className="text-sm text-muted-foreground">
          {po.supplier.name} · {po.status.toLowerCase().replace('_', ' ')}
          {po.expectedAt ? ` · expected ${po.expectedAt.toLocaleDateString('en-PK')}` : ''}
        </p>
      </header>

      <PurchaseOrderActions id={po.id} status={po.status} />

      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Ordered</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Unit cost</th>
                <th className="px-4 py-3">Landed</th>
                <th className="px-4 py-3">Line total</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item) => (
                <tr key={item.id} className="border-b border-border/60 last:border-b-0">
                  <td className="px-4 py-3">{item.variant.product.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {item.variant.sku}
                  </td>
                  <td className="px-4 py-3">{item.quantityOrdered}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.quantityReceived}</td>
                  <td className="px-4 py-3">{formatMoney(Number(item.unitCost), po.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatMoney(Number(unitLandedCost(item.unitCost, factor)), po.currency)}
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(Number(item.unitCost) * item.quantityOrdered, po.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border text-sm">
              <tr>
                <td colSpan={6} className="px-4 py-2 text-right text-muted-foreground">
                  Lines
                </td>
                <td className="px-4 py-2">{formatMoney(Number(linesValue), po.currency)}</td>
              </tr>
              <tr>
                <td colSpan={6} className="px-4 py-2 text-right text-muted-foreground">
                  Shipping, duty and other
                </td>
                <td className="px-4 py-2">{formatMoney(Number(charges), po.currency)}</td>
              </tr>
              <tr className="font-medium">
                <td colSpan={6} className="px-4 py-2 text-right">
                  Total
                </td>
                <td className="px-4 py-2">
                  {formatMoney(Number(linesValue.plus(charges)), po.currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {receivable && outstanding.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Receive delivery</CardTitle>
          </CardHeader>
          <CardContent>
            <ReceiveForm
              purchaseOrderId={po.id}
              currency={po.currency}
              lines={outstanding.map((item) => ({
                id: item.id,
                label: `${item.variant.product.name} · ${item.variant.sku}`,
                outstanding: item.quantityOrdered - item.quantityReceived,
                landedCost: Number(unitLandedCost(item.unitCost, factor)),
              }))}
            />
          </CardContent>
        </Card>
      ) : null}

      {po.receipts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Deliveries</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {po.receipts.map((receipt) => (
              <div key={receipt.id} className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{receipt.receivedAt.toLocaleString('en-PK')}</span>
                  <span className="text-xs text-muted-foreground">
                    {receipt.receiver
                      ? `${receipt.receiver.firstName ?? ''} ${receipt.receiver.lastName ?? ''}`.trim() ||
                        receipt.receiver.email
                      : 'System'}
                  </span>
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                  {receipt.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity} × at {formatMoney(Number(item.unitLandedCost), po.currency)}{' '}
                      landed
                    </li>
                  ))}
                </ul>
                {receipt.note ? (
                  <p className="mt-2 text-sm text-muted-foreground">{receipt.note}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
