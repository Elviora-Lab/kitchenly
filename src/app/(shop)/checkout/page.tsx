import { buildMetadata } from '@/lib/seo/metadata';

import { Section } from '@/design-system/primitives/section';

import { CheckoutClient } from './checkout-client';

import { getSession } from '@/server/auth/get-session';
import { getGuestId } from '@/server/auth/guest-session';
import { addressesService } from '@/server/services/addresses.service';
import { cartService } from '@/server/services/cart.service';

export const metadata = buildMetadata({ title: 'Checkout', path: '/checkout', noIndex: true });
export const dynamic = 'force-dynamic';

export default async function CheckoutPage() {
  // Guest checkout: no login required. A session, if present, unlocks saved
  // addresses; guests just fill the inline form. Read the guest id only — a
  // Server Component can't mint the cookie (that happens on add-to-cart).
  const session = await getSession();
  const guestId = await getGuestId();

  const [addresses, cart] = await Promise.all([
    session ? addressesService.list(session.sub) : Promise.resolve([]),
    // No identity yet → the bag is necessarily empty; skip cart lookup so we
    // don't try to create a cart for a non-existent session.
    session || guestId
      ? cartService.getCart({ userId: session?.sub ?? null, sessionId: guestId ?? '' })
      : Promise.resolve({ lines: [], subtotal: 0, currency: 'PKR' }),
  ]);

  return (
    <Section>
      <div className="container flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <span className="eyebrow">Final step</span>
          <h1 className="editorial-heading text-display-lg">Checkout</h1>
        </header>
        <CheckoutClient
          addresses={addresses.map((a) => ({
            id: a.id,
            fullName: a.fullName,
            phone: a.phone,
            country: a.country,
            city: a.city,
            area: a.area,
            addressLine1: a.addressLine1,
            addressLine2: a.addressLine2,
            postalCode: a.postalCode,
            isDefault: a.isDefault,
          }))}
          cart={{
            lines: cart.lines,
            subtotal: cart.subtotal,
            currency: cart.currency,
            flashSale: 'flashSale' in cart ? cart.flashSale : null,
          }}
        />
      </div>
    </Section>
  );
}
