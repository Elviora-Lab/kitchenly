import Link from 'next/link';

import { buildMetadata } from '@/lib/seo/metadata';
import { formatMoney } from '@/utils/format';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { LowStockThresholdForm } from './inventory-settings';
import { StockRow } from './stock-row';

import { inventoryRepo, type StockFilter } from '@/server/repositories/inventory.repo';
import { inventoryService } from '@/server/services/inventory.service';

export const metadata = buildMetadata({ title: 'Admin · Inventory', noIndex: true });
export const dynamic = 'force-dynamic';

const FILTERS: Array<{ value: StockFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Needs reorder' },
  { value: 'out', label: 'Out of stock' },
];

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const { q, filter: rawFilter, page: rawPage } = await searchParams;
  const filter: StockFilter = rawFilter === 'low' || rawFilter === 'out' ? rawFilter : 'all';
  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = 50;

  const threshold = await inventoryService.lowStockThreshold();
  const [{ items, total }, valuation, lowCount] = await Promise.all([
    inventoryRepo.listLevels({
      q,
      filter,
      defaultThreshold: threshold,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    inventoryRepo.valuation(),
    inventoryRepo.lowStockCount(threshold),
  ]);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="editorial-heading text-display-md">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Stock on hand, with every change recorded. Corrections here are posted to the ledger
            against your name — nothing edits the number silently.
          </p>
        </div>
        <Link
          href="/admin/inventory/reorder"
          className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
        >
          Reorder report →
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Stock value"
          value={formatMoney(valuation.totalValue)}
          hint={`${valuation.costedUnits.toLocaleString()} units at average cost`}
        />
        <Stat
          label="Not yet costed"
          value={valuation.uncostedUnits.toLocaleString()}
          hint="Units with no purchase history, excluded from the value above"
        />
        <Stat
          label="Needs reorder"
          value={lowCount.toLocaleString()}
          hint={`Default reorder point ${threshold}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reorder settings</CardTitle>
        </CardHeader>
        <CardContent>
          <LowStockThresholdForm threshold={threshold} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Stock levels</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <form action="/admin/inventory" className="flex gap-2">
              <input type="hidden" name="filter" value={filter} />
              <input
                type="search"
                name="q"
                defaultValue={q ?? ''}
                placeholder="SKU or product"
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              />
            </form>
            <nav className="flex gap-2 text-xs">
              {FILTERS.map((f) => {
                const params = new URLSearchParams();
                if (q) params.set('q', q);
                if (f.value !== 'all') params.set('filter', f.value);
                const href = `/admin/inventory${params.size ? `?${params}` : ''}`;

                return (
                  <Link
                    key={f.value}
                    href={href}
                    className={
                      filter === f.value
                        ? 'rounded-full bg-foreground px-3 py-1 text-background'
                        : 'rounded-full border border-border px-3 py-1 text-muted-foreground hover:text-foreground'
                    }
                  >
                    {f.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-border">
              <tr className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Reorder at</th>
                <th className="px-4 py-3">Order qty</th>
                <th className="px-4 py-3">Avg cost</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Nothing matches.
                  </td>
                </tr>
              ) : (
                items.map((variant) => (
                  <StockRow
                    key={variant.id}
                    variant={{
                      id: variant.id,
                      sku: variant.sku,
                      productName: variant.product.name,
                      descriptor: [variant.size, variant.shade, variant.fragrance]
                        .filter(Boolean)
                        .join(' · '),
                      stockQuantity: variant.stockQuantity,
                      reorderPoint: variant.reorderPoint,
                      reorderQuantity: variant.reorderQuantity,
                      avgCost: variant.avgCost === null ? null : Number(variant.avgCost),
                    }}
                    defaultThreshold={threshold}
                  />
                ))
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

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-light">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
