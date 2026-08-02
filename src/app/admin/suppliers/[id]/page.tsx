import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buildMetadata } from '@/lib/seo/metadata';
import { formatMoney } from '@/utils/format';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { SupplierPriceForm, SupplierPriceRowActions } from './supplier-prices';

import { suppliersRepo } from '@/server/repositories/purchasing.repo';

export const metadata = buildMetadata({ title: 'Admin · Supplier', noIndex: true });
export const dynamic = 'force-dynamic';

export default async function AdminSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplier = await suppliersRepo.findById(id);
  if (!supplier) notFound();

  const detail = [
    ['Contact', supplier.contactName],
    ['Email', supplier.email],
    ['Phone', supplier.phone],
    ['Payment terms', supplier.paymentTerms],
    ['Lead time', supplier.leadTimeDays === null ? null : `${supplier.leadTimeDays} days`],
    ['Address', supplier.address],
  ] as const;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/suppliers"
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          ← Suppliers
        </Link>
        <h1 className="editorial-heading text-display-md">{supplier.name}</h1>
        <p className="text-sm text-muted-foreground">
          {supplier.isActive ? 'Active supplier' : 'Inactive — cannot be used on new orders'}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {detail.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {label}
                </dt>
                <dd className="text-sm">{value || '—'}</dd>
              </div>
            ))}
          </dl>
          {supplier.notes ? (
            <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
              {supplier.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price list</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="text-sm text-muted-foreground">
            What this supplier charges, keyed to our SKU. Purchase order lines prefill from here,
            and the reorder report suggests the preferred supplier for each item.
          </p>
          <SupplierPriceForm supplierId={supplier.id} />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-2 py-3">Product</th>
                  <th className="px-2 py-3">Our SKU</th>
                  <th className="px-2 py-3">Their SKU</th>
                  <th className="px-2 py-3">Unit cost</th>
                  <th className="px-2 py-3">Min order</th>
                  <th className="px-2 py-3">Preferred</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {supplier.variants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-10 text-center text-muted-foreground">
                      Nothing priced yet.
                    </td>
                  </tr>
                ) : (
                  supplier.variants.map((link) => (
                    <tr key={link.id} className="border-b border-border/60 last:border-b-0">
                      <td className="px-2 py-3">{link.variant.product.name}</td>
                      <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                        {link.variant.sku}
                      </td>
                      <td className="px-2 py-3 font-mono text-xs text-muted-foreground">
                        {link.supplierSku || '—'}
                      </td>
                      <td className="px-2 py-3">
                        {link.unitCost === null ? '—' : formatMoney(Number(link.unitCost))}
                      </td>
                      <td className="px-2 py-3">{link.minOrderQuantity ?? '—'}</td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {link.isPreferred ? 'Yes' : '—'}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <SupplierPriceRowActions id={link.id} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
