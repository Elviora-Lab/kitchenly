import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';

import { formatMoney } from '@/utils/format';

import { variantCode, variantHex } from '@/app/admin/products/_lib/shade';

/**
 * Ordered items, built for whoever is packing the box.
 *
 * The shade is the thing that gets picked wrong, so it's shown three ways: the
 * variant's own photo, a colour swatch, and the shade code as text. The stored
 * `variantName` snapshot ("Size · Shade · Fragrance", with the shade carrying a
 * trailing `@#RRGGBB`) is only a fallback for items whose variant has since been
 * deleted — on its own it renders as an unlabelled code with a raw hex glued to
 * it, which is what made shades unreadable here before.
 */

export type OrderItemRow = {
  id: string;
  productName: string;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: { slug: string; imageUrl: string | null } | null;
  variant: {
    sku: string;
    size: string | null;
    shade: string | null;
    fragrance: string | null;
    imageUrl: string | null;
  } | null;
};

/** One `label: value` chip. The shade variant also carries its colour swatch. */
function Attribute({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px]">
      <span className="uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      {swatch ? (
        <span
          aria-hidden
          className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-border"
          style={{ backgroundColor: swatch }}
        />
      ) : null}
      <span className="font-medium">{value}</span>
    </span>
  );
}

function ItemThumbnail({ src, alt }: { src: string | null; alt: string }) {
  return (
    <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
      {src ? (
        <Image src={src} alt={alt} fill sizes="64px" className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-4" />
        </div>
      )}
    </div>
  );
}

function ItemCell({ item }: { item: OrderItemRow }) {
  const v = item.variant;
  // Prefer the variant's own photo — that IS the shade. Fall back to a generic
  // product shot, never to another variant's image.
  const imageUrl = v?.imageUrl ?? item.product?.imageUrl ?? null;

  const shadeLabel = v?.shade ? variantCode(v.shade) : null;
  const shadeSwatch = v?.shade ? (variantHex(v.shade) ?? undefined) : undefined;

  const hasStructured = Boolean(v && (v.shade || v.size || v.fragrance));

  return (
    <div className="flex items-start gap-3">
      <ItemThumbnail
        src={imageUrl}
        alt={shadeLabel ? `${item.productName} — ${shadeLabel}` : item.productName}
      />
      <div className="min-w-0 flex-1">
        {item.product ? (
          <Link
            href={`/products/${item.product.slug}`}
            target="_blank"
            className="font-medium hover:underline"
          >
            {item.productName}
          </Link>
        ) : (
          <span className="font-medium">{item.productName}</span>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {shadeLabel ? <Attribute label="Shade" value={shadeLabel} swatch={shadeSwatch} /> : null}
          {v?.size ? <Attribute label="Size" value={v.size} /> : null}
          {v?.fragrance ? <Attribute label="Scent" value={v.fragrance} /> : null}

          {/* Variant row is gone (deleted product/variant) — show the snapshot
              so the order still says what was bought. */}
          {!hasStructured && item.variantName ? (
            <Attribute label="Variant" value={variantCode(item.variantName)} />
          ) : null}
        </div>

        {v?.sku ? (
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">SKU {v.sku}</div>
        ) : null}
      </div>
    </div>
  );
}

export function OrderItems({
  items,
  currency,
  subtotal,
  shippingFee,
  taxAmount,
  discountAmount,
  discountLabel,
  totalAmount,
}: {
  items: OrderItemRow[];
  currency: string;
  subtotal: number;
  shippingFee: number;
  taxAmount: number;
  discountAmount: number;
  discountLabel: string | null;
  totalAmount: number;
}) {
  const unitCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="pb-2">Product</th>
            <th className="pb-2">Qty</th>
            <th className="pb-2">Unit</th>
            <th className="pb-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-border/60 align-top">
              <td className="py-3 pr-4">
                <ItemCell item={item} />
              </td>
              <td className="py-3 tabular-nums">×{item.quantity}</td>
              <td className="py-3 tabular-nums">{formatMoney(item.unitPrice, currency)}</td>
              <td className="py-3 text-right tabular-nums">
                {formatMoney(item.totalPrice, currency)}
              </td>
            </tr>
          ))}

          <tr className="border-t border-border">
            <td colSpan={3} className="pt-3 text-right text-sm text-muted-foreground">
              Subtotal
              <span className="ml-2 text-xs">
                ({unitCount} unit{unitCount === 1 ? '' : 's'})
              </span>
            </td>
            <td className="pt-3 text-right tabular-nums">{formatMoney(subtotal, currency)}</td>
          </tr>
          <tr>
            <td colSpan={3} className="text-right text-sm text-muted-foreground">
              Shipping
            </td>
            <td className="text-right tabular-nums">{formatMoney(shippingFee, currency)}</td>
          </tr>
          {taxAmount > 0 ? (
            <tr>
              <td colSpan={3} className="text-right text-sm text-muted-foreground">
                Tax
              </td>
              <td className="text-right tabular-nums">{formatMoney(taxAmount, currency)}</td>
            </tr>
          ) : null}
          {discountAmount > 0 && (
            <tr>
              <td colSpan={3} className="text-right text-sm text-muted-foreground">
                {discountLabel ?? 'Discount'}
              </td>
              <td className="text-right tabular-nums">−{formatMoney(discountAmount, currency)}</td>
            </tr>
          )}
          <tr className="border-t border-border">
            <td colSpan={3} className="pt-2 text-right font-medium">
              Total
            </td>
            <td className="pt-2 text-right font-medium tabular-nums">
              {formatMoney(totalAmount, currency)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
