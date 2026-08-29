'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { closeCart, toggleCart } from '@/store/slices/ui-slice';

import { FREE_SHIPPING_THRESHOLD } from '@/lib/shipping';

import { EmptyState } from '@/design-system/primitives/empty-state';
import { Price } from '@/design-system/primitives/price';
import { QuantitySelector } from '@/design-system/primitives/quantity-selector';
import { FlashSaleNotice } from '@/components/commerce/flash-sale-notice';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { RewardsLadder } from '@/features/promotions/components/rewards-ladder';

import { useRemoveCartLineMutation, useUpdateCartLineMutation } from '../api/cart-api';
import { useCart } from '../hooks/use-cart';
import { selectCartFlashSale, selectCartFlashSavings } from '../store/cart-slice';

export function CartDrawerTrigger() {
  const count = useCart().count;
  const dispatch = useAppDispatch();
  return (
    <button
      type="button"
      onClick={() => dispatch(toggleCart())}
      className="relative grid size-10 place-items-center rounded-full transition-colors hover:bg-muted"
      aria-label={`Open cart (${count} items)`}
    >
      <ShoppingBag className="size-5" />
      {count > 0 ? (
        <span
          key={count}
          className="absolute -right-1 -top-1 grid h-5 min-w-5 animate-pop-in place-items-center rounded-full bg-brand-ember px-1.5 text-[10px] font-semibold tabular-nums text-white shadow-soft"
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function CartDrawer() {
  const open = useAppSelector((s) => s.ui.cartOpen);
  const dispatch = useAppDispatch();
  const { cart, subtotal, count, updateQty, remove } = useCart();
  const flashSale = useAppSelector(selectCartFlashSale);
  const flashSavings = useAppSelector(selectCartFlashSavings);
  const [updateLine] = useUpdateCartLineMutation();
  const [removeLineMutation] = useRemoveCartLineMutation();

  function handleUpdateQty(line: { id?: string; productId: string; variantId: string }, q: number) {
    // Optimistic Redux update for instant feedback.
    updateQty(line.productId, line.variantId, q);
    // Persist server-side. Skip if we don't yet have a DB id (line was just
    // added optimistically — CartHydrator will catch up on the next refetch).
    if (line.id) {
      updateLine({ lineId: line.id, quantity: q })
        .unwrap()
        .catch(() => {
          // Mutation invalidates Cart tag on failure too; the next refetch
          // re-hydrates Redux to the server's truth.
        });
    }
  }

  function handleRemove(line: { id?: string; productId: string; variantId: string }) {
    remove(line.productId, line.variantId);
    if (line.id) {
      removeLineMutation({ lineId: line.id })
        .unwrap()
        .catch(() => undefined);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => (o ? null : dispatch(closeCart()))}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>
            {count > 0
              ? `${count} item${count === 1 ? '' : 's'} — free delivery over Rs ${FREE_SHIPPING_THRESHOLD.toLocaleString('en-US')}.`
              : 'Your cart is currently empty.'}
          </SheetDescription>
        </SheetHeader>

        <div className="my-6 flex-1 overflow-y-auto pr-1">
          {cart.lines.length === 0 ? (
            <EmptyState
              title="Your cart is empty"
              description="Stock up on kitchen tools, storage, and everyday essentials."
              action={
                <Button asChild variant="cta">
                  <Link href="/products" onClick={() => dispatch(closeCart())}>
                    Start shopping
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-5">
              {cart.lines.map((line) => (
                <li key={`${line.productId}-${line.variantId}`} className="flex gap-4">
                  <div className="relative size-24 shrink-0 overflow-hidden rounded-md border border-border bg-white">
                    {line.imageUrl ? (
                      <Image
                        src={line.imageUrl}
                        alt={line.name}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="absolute inset-0 grid place-items-center font-serif text-[9px] uppercase tracking-[0.2em] text-brand-steel/40"
                      >
                        Kitchenly
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Link
                      href={`/products/${line.slug}`}
                      onClick={() => dispatch(closeCart())}
                      className="line-clamp-2 text-sm font-medium leading-snug transition-colors hover:text-accent"
                    >
                      {line.name}
                    </Link>
                    <Price
                      amount={line.unitPrice}
                      compareAt={line.originalPrice}
                      currency={line.currency}
                      size="sm"
                    />
                    <div className="mt-auto flex items-center justify-between">
                      <QuantitySelector
                        value={line.quantity}
                        onChange={(q) => handleUpdateQty(line, q)}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemove(line)}
                        className="text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.lines.length > 0 ? (
          <SheetFooter className="flex-col gap-4 sm:flex-col sm:items-stretch">
            {flashSale ? (
              <FlashSaleNotice
                title={flashSale.title}
                endsAt={flashSale.endsAt}
                savings={flashSavings}
                currency={cart.lines[0]?.currency ?? 'PKR'}
              />
            ) : null}
            <RewardsLadder subtotal={subtotal} currency={cart.lines[0]?.currency ?? 'PKR'} />
            <div className="flex items-center justify-between text-sm">
              <span className="eyebrow">Subtotal</span>
              <Price amount={subtotal} currency={cart.lines[0]?.currency ?? 'PKR'} size="lg" />
            </div>
            <p className="text-balance text-xs text-muted-foreground">
              Shipping and discounts are calculated at checkout.
            </p>
            <Button asChild size="lg" variant="cta" uppercase>
              <Link href="/checkout" onClick={() => dispatch(closeCart())}>
                Checkout
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/cart" onClick={() => dispatch(closeCart())}>
                View cart
              </Link>
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
