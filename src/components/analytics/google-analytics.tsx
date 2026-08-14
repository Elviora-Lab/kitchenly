'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';

import { ga, GA_ID, gaDebug, gaEnabled } from '@/lib/analytics/google';

/**
 * Google Analytics 4 (gtag.js) base tag.
 *
 * Loads gtag once, declares Consent Mode v2 defaults, then lets the `config`
 * call send the initial `page_view`, and fires a fresh `page_view` on each
 * client-side navigation (App Router route changes don't reload the page, so
 * gtag wouldn't see them otherwise).
 *
 * Rendered in the root layout. Active in production when a Measurement ID is
 * set. `NEXT_PUBLIC_GA_DEBUG=true` only adds DebugView metadata after the
 * production gate passes; it never loads GA on localhost.
 *
 * Consent Mode: we grant all signals by default because the store has no cookie
 * banner today and already tracks unconditionally. When a CMP is added, flip
 * these defaults to `'denied'` and call `ga.consentUpdate({...})` on acceptance.
 *
 * Keys page views on `usePathname` only (like `<MetaPixel />`), so a
 * query-string-only navigation (e.g. `/search?q=…`) doesn't emit a new one.
 */
const active = Boolean(GA_ID) && gaEnabled;

export function GoogleAnalytics() {
  const pathname = usePathname();
  const initialised = useRef(false);

  useEffect(() => {
    if (!active) return;
    // The `config` call already sends a page_view on first load — skip that
    // first effect run so it isn't double-counted, then fire on every route.
    if (!initialised.current) {
      initialised.current = true;
      return;
    }
    ga.pageView({ page_location: window.location.href, page_title: document.title });
  }, [pathname]);

  if (!active) return null;

  const configOpts = gaDebug ? ', { debug_mode: true }' : '';

  return (
    <>
      <Script
        id="ga-gtag-loader"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      />
      <Script id="ga-gtag-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('consent', 'default', {ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted',functionality_storage:'granted',personalization_storage:'granted',security_storage:'granted'});
gtag('config', '${GA_ID}'${configOpts});`}
      </Script>
    </>
  );
}
