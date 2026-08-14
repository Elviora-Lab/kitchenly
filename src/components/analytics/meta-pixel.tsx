'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

import { FB_PIXEL_ID, pixelEnabled } from '@/lib/analytics/meta-pixel';

/**
 * Meta (Facebook) Pixel base code.
 *
 * Injects the pixel loader once and fires the initial PageView, then fires a
 * fresh PageView on each client-side navigation (the base snippet only fires on
 * a full page load, so App Router route changes need this). Rendered in the
 * root layout; only active in production.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const initialised = useRef(false);

  useEffect(() => {
    if (!pixelEnabled) return;
    // The base snippet already fires PageView on first load — skip that first
    // run so it isn't double-counted, then fire on every subsequent route.
    if (!initialised.current) {
      initialised.current = true;
      return;
    }
    window.fbq?.('track', 'PageView');
  }, [pathname]);

  if (!pixelEnabled) return null;

  return (
    <>
      {/* `afterInteractive`, not `lazyOnload`: lazyOnload waits for the full load
          event, so a shopper who bounces or navigates quickly is never counted —
          and every ViewContent/AddToCart before it lands is dropped, since the
          helpers no-op until `fbq` exists. */}
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('set', 'autoConfig', false, '${FB_PIXEL_ID}');
fbq('init', '${FB_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
