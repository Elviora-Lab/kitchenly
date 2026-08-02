import Link from 'next/link';

import { buildMetadata } from '@/lib/seo/metadata';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { SupplierForm } from './supplier-form';

import { suppliersRepo } from '@/server/repositories/purchasing.repo';

export const metadata = buildMetadata({ title: 'Admin · Suppliers', noIndex: true });
export const dynamic = 'force-dynamic';

export default async function AdminSuppliersPage() {
  const suppliers = await suppliersRepo.listAll();

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="editorial-heading text-display-md">Suppliers</h1>
        <p className="text-sm text-muted-foreground">
          Who stock is bought from. Separate from brands — one supplier may carry several brands,
          and the same brand can come from more than one of them.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add supplier</CardTitle>
        </CardHeader>
        <CardContent>
          <SupplierForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All suppliers</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Terms</th>
                <th className="px-4 py-3">Lead time</th>
                <th className="px-4 py-3">Priced items</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No suppliers yet. Add one above to start raising purchase orders.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-b-0">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/admin/suppliers/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.contactName || s.email || s.phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.paymentTerms || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.leadTimeDays === null ? '—' : `${s.leadTimeDays} days`}
                    </td>
                    <td className="px-4 py-3">{s._count.variants}</td>
                    <td className="px-4 py-3">{s._count.purchaseOrders}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.isActive ? 'Active' : 'Inactive'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
