'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { toast } from 'sonner';

import { firebasePushConfigured, requestPushSubscription } from '@/lib/marketing/push-client';
import { getAnonymousVisitorId } from '@/lib/marketing/visitor-client';

import { Button } from '@/components/ui/button';

type ProductPushAlertButtonProps = {
  productId: string;
  variantId?: string | null;
  type?: 'PRICE_DROP' | 'BACK_IN_STOCK' | 'DEAL';
};

export function ProductPushAlertButton({
  productId,
  variantId,
  type = 'PRICE_DROP',
}: ProductPushAlertButtonProps) {
  const [pending, setPending] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const label = type === 'BACK_IN_STOCK' ? 'Back-in-stock alert' : 'Price drop alert';
  const savedLabel = type === 'BACK_IN_STOCK' ? 'Restock alert saved' : 'Price alert saved';

  if (!firebasePushConfigured()) return null;

  async function subscribe() {
    setPending(true);
    const push = await requestPushSubscription();
    if (!push.ok) {
      setPending(false);
      toast.error(
        push.reason === 'not_configured'
          ? 'Push alerts are not configured yet'
          : 'Push alerts are not available in this browser',
      );
      return;
    }

    const res = await fetch('/api/v1/push/product-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonymousId: getAnonymousVisitorId(),
        productId,
        variantId,
        type,
        pagePath: `${window.location.pathname}${window.location.search}`,
      }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as {
      success?: boolean;
      data?: { subscribed?: boolean };
      message?: string;
    } | null;
    setPending(false);

    if (!res?.ok || !json?.success || !json.data?.subscribed) {
      toast.error(json?.message ?? 'Could not save this alert');
      return;
    }
    setSubscribed(true);
    toast.success(savedLabel);
  }

  return (
    <Button
      type="button"
      variant={subscribed ? 'secondary' : 'outline'}
      size="md"
      loading={pending}
      disabled={subscribed}
      onClick={subscribe}
      className="w-full"
    >
      <Bell className="size-4" aria-hidden />
      {subscribed ? savedLabel : label}
    </Button>
  );
}
