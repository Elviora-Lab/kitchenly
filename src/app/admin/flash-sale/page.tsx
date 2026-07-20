import { MAX_FLASH_SALE_ITEMS } from '@/lib/flash-sale';
import { buildMetadata } from '@/lib/seo/metadata';

import { FlashSaleAdmin } from './flash-sale-admin';

import { adminFlashSaleRepo } from '@/server/repositories/flash-sale.repo';

export const metadata = buildMetadata({ title: 'Admin · Flash sale', noIndex: true });
export const dynamic = 'force-dynamic';

export default async function AdminFlashSalePage() {
  const sales = await adminFlashSaleRepo.list();

  // Decimals can't cross into a client component — convert at the boundary,
  // the same way the products and orders admin pages do.
  const rows = sales.map((sale) => ({
    id: sale.id,
    title: sale.title,
    startsAt: sale.startsAt.toISOString(),
    endsAt: sale.endsAt.toISOString(),
    isActive: sale.isActive,
    items: sale.items.map((item) => ({
      productId: item.productId,
      discountPercent: item.discountPercent,
      name: item.product.name,
      slug: item.product.slug,
      price: Number(item.product.price),
      imageUrl: item.product.images[0]?.imageUrl ?? '',
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="editorial-heading text-display-md">Flash sale</h1>
        <p className="text-sm text-muted-foreground">
          Schedule a discount window over up to {MAX_FLASH_SALE_ITEMS} products. The homepage
          section appears and retires on its own — only one sale runs at a time.
        </p>
      </header>
      <FlashSaleAdmin sales={rows} />
    </div>
  );
}
