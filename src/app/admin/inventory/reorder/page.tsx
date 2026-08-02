import Link from 'next/link';

import { buildMetadata } from '@/lib/seo/metadata';
import { formatMoney } from '@/utils/format';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { inventoryRepo } from '@/server/repositories/inventory.repo';
import { inventoryService } from '@/server/services/inventory.service';

export const metadata = buildMetadata({ title: 'Admin · Reorder report', noIndex: true });
export const dynamic = 'force-dynamic';

export default async function AdminReorderPage() {
  const threshold = await inventoryService.lowStockThreshold();
  const rows = await inventoryRepo.reorderSuggestions(threshold);

  // Group by preferred supplier so the buyer can raise one PO per house.
  const bySupplier = new Map<string, { name: string; items: typeof rows }>();

  for (const row of rows) {
    const key = row.supplier_id ?? 'unassigned';
    const name = row.supplier_name ?? 'No preferred supplier';
    const group = bySupplier.get(key) ?? { name, items: [] };
    group.items.push(row);
    bySupplier.set(key, group);
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href="/admin/inventory"
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          ← Inventory
        </Link>
        <h1 className="editorial-heading text-display-md">Reorder report</h1>
        <p className="text-sm text-muted-foreground">
          Active variants at or below their reorder point, grouped by preferred supplier. Suggested
          quantities come from each variant&rsquo;s own rule, falling back to the supplier&rsquo;s
          minimum.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Everything is above its reorder point.
          </CardContent>
        </Card>
      ) : (
        Array.from(bySupplier.entries()).map(([key, group]) => (
          <Card key={key}>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <CardTitle>{group.name}</CardTitle>
              {key !== 'unassigned' ? (
                <Link
                  href={`/admin/purchasing?supplier=${key}`}
                  className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                >
                  Raise a PO →
                </Link>
              ) : (
                <Link
                  href="/admin/suppliers"
                  className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
                >
                  Assign suppliers →
                </Link>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">On hand</th>
                    <th className="px-4 py-3">Reorder at</th>
                    <th className="px-4 py-3">Suggest</th>
                    <th className="px-4 py-3">Last cost</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((row) => (
                    <tr key={row.variant_id} className="border-b border-border/60 last:border-b-0">
                      <td className="px-4 py-3">{row.product_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {row.sku}
                      </td>
                      <td className="px-4 py-3 font-medium text-destructive">
                        {row.stock_quantity}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.reorder_point}</td>
                      <td className="px-4 py-3">{row.reorder_quantity ?? '—'}</td>
                      <td className="px-4 py-3">
                        {row.unit_cost === null ? '—' : formatMoney(Number(row.unit_cost))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
