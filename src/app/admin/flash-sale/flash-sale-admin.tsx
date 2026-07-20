'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Search, X } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/cn';
import {
  flashPrice,
  MAX_FLASH_DISCOUNT_PERCENT,
  MAX_FLASH_SALE_ITEMS,
  MIN_FLASH_DISCOUNT_PERCENT,
} from '@/lib/flash-sale';
import { formatDate, formatMoney } from '@/utils/format';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  createFlashSale,
  deleteFlashSale,
  searchFlashSaleProducts,
  setFlashSaleItems,
  toggleFlashSale,
  updateFlashSale,
} from '@/server/actions/admin/flash-sale.actions';

type SaleItem = {
  productId: string;
  discountPercent: number;
  name: string;
  slug: string;
  price: number;
  imageUrl: string;
};

type Sale = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  items: SaleItem[];
};

/** Applied to a product the moment it's picked; editable per row afterwards. */
const DEFAULT_DISCOUNT_PERCENT = 20;

/** ISO instant → the `YYYY-MM-DDTHH:mm` a datetime-local input expects, in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export function FlashSaleAdmin({ sales }: { sales: Sale[] }) {
  const [editingId, setEditingId] = useState<string | null>(sales[0]?.id ?? null);
  const editing = sales.find((s) => s.id === editingId) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-6">
        <SaleForm key={editing?.id ?? 'new'} sale={editing} onDone={setEditingId} />
        <SaleList sales={sales} editingId={editingId} onEdit={setEditingId} />
      </div>

      {editing ? (
        <ItemsEditor key={editing.id} sale={editing} />
      ) : (
        <Card className="h-fit">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Create a sale window, then curate its products here.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Create or edit the sale window itself. */
function SaleForm({ sale, onDone }: { sale: Sale | null; onDone: (id: string | null) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    title: sale?.title ?? 'Flash Sale',
    startsAt: sale ? toLocalInput(sale.startsAt) : '',
    endsAt: sale ? toLocalInput(sale.endsAt) : '',
    isActive: sale?.isActive ?? false,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = sale
        ? await updateFlashSale({ ...form, id: sale.id })
        : await createFlashSale(form);
      if (res.success) {
        toast.success(sale ? 'Sale updated' : 'Sale created');
        onDone(res.data.id);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Card className="h-fit">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">{sale ? 'Edit window' : 'New flash sale'}</CardTitle>
        {sale ? (
          <button
            type="button"
            onClick={() => onDone(null)}
            className="text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
          >
            New
          </button>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fs-title">Title</Label>
            <Input
              id="fs-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={120}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fs-starts">Starts</Label>
            <Input
              id="fs-starts"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fs-ends">Ends</Label>
            <Input
              id="fs-ends"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Times are in your local timezone. Discounts stop at the exact end instant.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="size-4 rounded border-input"
            />
            Active — deactivates any other running sale
          </label>

          <Button type="submit" loading={pending} uppercase>
            {sale ? 'Save window' : 'Create'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SaleList({
  sales,
  editingId,
  onEdit,
}: {
  sales: Sale[];
  editingId: string | null;
  onEdit: (id: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onToggle(id: string, isActive: boolean) {
    start(async () => {
      const res = await toggleFlashSale({ id, isActive });
      if (res.success) router.refresh();
      else toast.error(res.message);
    });
  }

  function onDelete(id: string) {
    if (!confirm('Delete this flash sale and its curated products?')) return;
    start(async () => {
      const res = await deleteFlashSale({ id });
      if (res.success) {
        toast.success('Flash sale deleted');
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  if (sales.length === 0) {
    return <p className="text-sm text-muted-foreground">No flash sales yet.</p>;
  }

  const now = Date.now();

  return (
    <div className="flex flex-col gap-2">
      {sales.map((sale) => {
        const live =
          sale.isActive &&
          now >= new Date(sale.startsAt).getTime() &&
          now < new Date(sale.endsAt).getTime();
        const ended = now >= new Date(sale.endsAt).getTime();

        return (
          <Card
            key={sale.id}
            className={cn(
              'cursor-pointer transition-colors',
              sale.id === editingId && 'border-accent',
            )}
            onClick={() => onEdit(sale.id)}
          >
            <CardContent className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{sale.title}</span>
                  {live ? (
                    <Badge variant="deal">Live</Badge>
                  ) : ended ? (
                    <Badge variant="muted">Ended</Badge>
                  ) : sale.isActive ? (
                    <Badge variant="info">Scheduled</Badge>
                  ) : (
                    <Badge variant="outline">Draft</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(sale.startsAt, { dateStyle: 'medium', timeStyle: 'short' })} →{' '}
                  {formatDate(sale.endsAt, { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
                  {sale.items.length} item{sale.items.length === 1 ? '' : 's'}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant={sale.isActive ? 'outline' : 'secondary'}
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(sale.id, !sale.isActive);
                }}
              >
                {sale.isActive ? 'Active' : 'Off'}
              </Button>
              <button
                type="button"
                disabled={pending}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(sale.id);
                }}
                className="text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * The curated product list: search to add, drag to reorder, per-row discount.
 *
 * Order is implicit — array position becomes `position` on save, so there's no
 * separate reorder action to keep in sync.
 */
function ItemsEditor({ sale }: { sale: Sale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState<SaleItem[]>(sale.items);

  const dirty = useMemo(
    () =>
      items.length !== sale.items.length ||
      items.some(
        (item, i) =>
          item.productId !== sale.items[i]?.productId ||
          item.discountPercent !== sale.items[i]?.discountPercent,
      ),
    [items, sale.items],
  );

  const full = items.length >= MAX_FLASH_SALE_ITEMS;

  function add(product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    imageUrl: string;
  }) {
    if (full) {
      toast.error(`A flash sale holds at most ${MAX_FLASH_SALE_ITEMS} products`);
      return;
    }
    if (items.some((i) => i.productId === product.id)) {
      toast.error('That product is already in this sale');
      return;
    }
    setItems([
      ...items,
      {
        productId: product.id,
        discountPercent: DEFAULT_DISCOUNT_PERCENT,
        name: product.name,
        slug: product.slug,
        price: product.price,
        imageUrl: product.imageUrl,
      },
    ]);
  }

  function save() {
    start(async () => {
      const res = await setFlashSaleItems({
        id: sale.id,
        items: items.map((i) => ({ productId: i.productId, discountPercent: i.discountPercent })),
      });
      if (res.success) {
        toast.success(`Saved ${res.data.count} product${res.data.count === 1 ? '' : 's'}`);
        router.refresh();
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <Card className="h-fit">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg">Products in “{sale.title}”</CardTitle>
        <span
          className={cn(
            'text-sm font-medium tabular-nums',
            full ? 'text-brand-ember' : 'text-muted-foreground',
          )}
        >
          {items.length} / {MAX_FLASH_SALE_ITEMS}
        </span>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <ProductPicker onAdd={add} disabled={full} excludeIds={items.map((i) => i.productId)} />

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No products yet. Search above to add the first one.
          </p>
        ) : (
          <Reorder.Group
            axis="y"
            values={items}
            onReorder={setItems}
            className="flex flex-col gap-2"
          >
            {items.map((item, index) => (
              <ItemRow
                key={item.productId}
                item={item}
                index={index}
                onChangeDiscount={(percent) =>
                  setItems(
                    items.map((i) =>
                      i.productId === item.productId ? { ...i, discountPercent: percent } : i,
                    ),
                  )
                }
                onRemove={() => setItems(items.filter((i) => i.productId !== item.productId))}
              />
            ))}
          </Reorder.Group>
        )}

        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} loading={pending} disabled={!dirty} uppercase>
            Save products
          </Button>
          {dirty ? <span className="text-xs text-muted-foreground">Unsaved changes</span> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ItemRow({
  item,
  index,
  onChangeDiscount,
  onRemove,
}: {
  item: SaleItem;
  index: number;
  onChangeDiscount: (percent: number) => void;
  onRemove: () => void;
}) {
  // Drag only from the handle — otherwise the number input can't be selected.
  const controls = useDragControls();
  const sale = flashPrice(item.price, item.discountPercent);

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 rounded-lg border border-border bg-background p-2"
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={`Reorder ${item.name}`}
      >
        <GripVertical className="size-4" />
      </button>

      <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">
        {index + 1}
      </span>

      <span className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
        {item.imageUrl ? (
          <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />
        ) : null}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        <div className="text-xs text-muted-foreground">
          <span className="line-through">{formatMoney(item.price)}</span>{' '}
          <span className="font-semibold text-brand-ember">{formatMoney(sale)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={item.discountPercent}
          min={MIN_FLASH_DISCOUNT_PERCENT}
          max={MAX_FLASH_DISCOUNT_PERCENT}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChangeDiscount(Math.trunc(next));
          }}
          className="w-16 text-right"
          aria-label={`Discount percent for ${item.name}`}
        />
        <span className="text-sm text-muted-foreground">%</span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="rounded p-1 text-muted-foreground hover:text-destructive"
        aria-label={`Remove ${item.name}`}
      >
        <X className="size-4" />
      </button>
    </Reorder.Item>
  );
}

/** Debounced type-ahead over active products. */
function ProductPicker({
  onAdd,
  disabled,
  excludeIds,
}: {
  onAdd: (p: { id: string; name: string; slug: string; price: number; imageUrl: string }) => void;
  disabled: boolean;
  excludeIds: string[];
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    Array<{ id: string; name: string; slug: string; price: number; imageUrl: string }>
  >([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    // `cancelled` guards against an earlier, slower search overwriting a later
    // one — the classic out-of-order autocomplete bug.
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await searchFlashSaleProducts({ query });
      if (cancelled) return;
      setSearching(false);
      if (res.success) setResults(res.data.products);
      else toast.error(res.message);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const visible = results.filter((r) => !excludeIds.includes(r.id));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            disabled
              ? `Full — ${MAX_FLASH_SALE_ITEMS} products is the limit`
              : 'Search products by name or SKU…'
          }
          disabled={disabled}
          className="pl-9"
          aria-label="Search products to add to the flash sale"
        />
      </div>

      {query.trim().length >= 2 && !disabled ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          {searching ? (
            <p className="p-3 text-sm text-muted-foreground">Searching…</p>
          ) : visible.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No matching products.</p>
          ) : (
            visible.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onAdd(p);
                  setQuery('');
                }}
                className="flex w-full items-center gap-3 border-b border-border p-2 text-left last:border-b-0 hover:bg-muted"
              >
                <span className="relative size-9 shrink-0 overflow-hidden rounded bg-muted">
                  {p.imageUrl ? (
                    <Image src={p.imageUrl} alt="" fill sizes="36px" className="object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatMoney(p.price)}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
