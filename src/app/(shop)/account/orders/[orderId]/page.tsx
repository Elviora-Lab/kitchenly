import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buildMetadata } from '@/lib/seo/metadata';
import { formatDate, formatMoney } from '@/utils/format';

import { Price } from '@/design-system/primitives/price';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { ReturnSection } from './return-section';

import { requireUser } from '@/server/auth/guards';
import { returnsRepo } from '@/server/repositories/returns.repo';
import { ordersService } from '@/server/services/orders.service';

export const metadata = buildMetadata({
  title: 'Order',
  noIndex: true,
});

export const dynamic = 'force-dynamic';

type Params = Promise<{ orderId: string }>;

const STATUS_VARIANT: Record<string, 'muted' | 'success' | 'gold' | 'danger'> = {
  PENDING: 'muted',
  CONFIRMED: 'gold',
  PROCESSING: 'gold',
  SHIPPED: 'gold',
  DELIVERED: 'success',
  CANCELLED: 'danger',
  RETURNED: 'danger',
  REFUNDED: 'danger',
};

export default async function CustomerOrderDetailPage({ params }: { params: Params }) {
  const session = await requireUser();
  const { orderId } = await params;

  let order;
  try {
    order = await ordersService.getDetail(orderId, session.sub);
  } catch {
    notFound();
  }

  const existingReturn = await returnsRepo.findByOrder(orderId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/account/orders"
            className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
          >
            ← All orders
          </Link>
          <h1 className="editorial-heading mt-2 font-mono text-display-md">{order.orderNumber}</h1>
          <p className="text-sm text-muted-foreground">
            Placed {formatDate(order.createdAt, { dateStyle: 'long', timeStyle: 'short' })}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[order.orderStatus] ?? 'muted'}>{order.orderStatus}</Badge>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="pb-2">Product</th>
                    <th className="pb-2">Qty</th>
                    <th className="pb-2 text-right">Unit</th>
                    <th className="pb-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-t border-border/60">
                      <td className="py-3">
                        <div>{item.productName}</div>
                        {item.variantName ? (
                          <div className="text-xs text-muted-foreground">{item.variantName}</div>
                        ) : null}
                      </td>
                      <td className="py-3">{item.quantity}</td>
                      <td className="py-3 text-right">
                        {/* Use a number to keep alignment if Price layout shifts */}
                        <Price
                          amount={Number(item.unitPrice)}
                          currency={order.currency}
                          size="sm"
                        />
                      </td>
                      <td className="py-3 text-right">
                        <Price
                          amount={Number(item.totalPrice)}
                          currency={order.currency}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {order.statusHistory.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Status history</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-3 text-sm">
                  {order.statusHistory
                    .slice()
                    .reverse()
                    .map((h) => (
                      <li key={h.id} className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant="muted">{h.status}</Badge>
                          {h.note ? (
                            <span className="text-xs text-muted-foreground">{h.note}</span>
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(h.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </li>
                    ))}
                </ol>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="flex h-fit flex-col gap-6 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Row label="Subtotal" amount={Number(order.subtotal)} currency={order.currency} />
              <Row label="Shipping" amount={Number(order.shippingFee)} currency={order.currency} />
              {Number(order.discountAmount) > 0 && (
                <Row
                  label="Discount"
                  amount={-Number(order.discountAmount)}
                  currency={order.currency}
                />
              )}
              <div className="soft-divider my-1" />
              <div className="flex items-center justify-between">
                <span className="eyebrow">Total</span>
                <Price amount={Number(order.totalAmount)} currency={order.currency} size="lg" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Badge variant={order.paymentStatus === 'PAID' ? 'success' : 'muted'}>
                {order.paymentStatus}
              </Badge>
              {order.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payment attempts recorded.</p>
              ) : (
                <ul className="text-xs text-muted-foreground">
                  {order.payments.map((p) => (
                    <li key={p.id}>
                      {p.paymentMethod} —{' '}
                      <span className="tabular-nums">
                        {formatMoney(Number(p.amount), order.currency)}
                      </span>{' '}
                      ({p.paymentStatus})
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {order.shipments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Shipping</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {order.shipments.map((s) => (
                  <div key={s.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span>{s.courierName}</span>
                      <Badge variant="muted">{s.shipmentStatus}</Badge>
                    </div>
                    {s.trackingNumber ? (
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.trackingNumber}
                      </span>
                    ) : null}
                    {s.deliveredAt ? (
                      <span className="text-xs text-muted-foreground">
                        Delivered {formatDate(s.deliveredAt, { dateStyle: 'medium' })}
                      </span>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Returns</CardTitle>
            </CardHeader>
            <CardContent>
              <ReturnSection
                orderId={order.id}
                orderStatus={order.orderStatus}
                existing={
                  existingReturn
                    ? { status: existingReturn.status, reason: existingReturn.reason }
                    : null
                }
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, amount, currency }: { label: string; amount: number; currency: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Price amount={amount} currency={currency} size="sm" />
    </div>
  );
}
