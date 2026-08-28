import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';

import { cn } from '@/lib/cn';

import { variantCode, variantHex } from '@/app/admin/products/_lib/shade';

/** Strip the trailing `@#RRGGBB` shade encoding used in order snapshots. */
export function displayVariant(variantName: string | null): string {
  if (!variantName) return '—';
  return (
    variantName
      .split(' · ')
      .map((part) => part.replace(/@#[0-9A-Fa-f]{6}$/, ''))
      .filter(Boolean)
      .join(' · ') || '—'
  );
}

export function shadeLabel(shade: string | null | undefined): string | null {
  if (!shade) return null;
  return variantCode(shade);
}

function Chip({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
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

export function ProductThumb({
  src,
  alt,
  size = 48,
}: {
  src: string | null;
  alt: string;
  size?: number;
}) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md border border-border bg-muted"
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-3.5" />
        </div>
      )}
    </div>
  );
}

type ProductCellProps = {
  productName: string;
  productSlug: string | null;
  imageUrl: string | null;
  sku: string | null;
  variantName?: string | null;
  size?: string | null;
  shade?: string | null;
  fragrance?: string | null;
  compact?: boolean;
};

/** Thumbnail + linked product name + variant chips — same language as order detail. */
export function ProductCell({
  productName,
  productSlug,
  imageUrl,
  sku,
  variantName,
  size,
  shade,
  fragrance,
  compact,
}: ProductCellProps) {
  const shadeText = shadeLabel(shade);
  const shadeSwatch = shade ? (variantHex(shade) ?? undefined) : undefined;
  const hasStructured = Boolean(size || shadeText || fragrance);
  const thumb = compact ? 40 : 48;

  return (
    <div className={cn('flex items-start gap-3', compact && 'gap-2.5')}>
      <ProductThumb
        src={imageUrl}
        alt={shadeText ? `${productName} — ${shadeText}` : productName}
        size={thumb}
      />
      <div className="min-w-0 flex-1">
        {productSlug ? (
          <Link
            href={`/products/${productSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
          >
            {productName}
          </Link>
        ) : (
          <span className="font-medium">{productName}</span>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {shadeText ? <Chip label="Shade" value={shadeText} swatch={shadeSwatch} /> : null}
          {size ? <Chip label="Size" value={size} /> : null}
          {fragrance ? <Chip label="Scent" value={fragrance} /> : null}
          {!hasStructured && variantName ? (
            <Chip label="Variant" value={displayVariant(variantName)} />
          ) : null}
        </div>

        {sku ? (
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">SKU {sku}</div>
        ) : null}
      </div>
    </div>
  );
}
