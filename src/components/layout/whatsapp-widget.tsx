'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

import { siteConfig } from '@/config/site';

const TEASER_KEY = 'ktc_wa_teaser_shown';

/** WhatsApp brand glyph — lucide has no WhatsApp icon, so inline the path. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
    </svg>
  );
}

/**
 * Floating WhatsApp chat widget — bottom-right on every shop page.
 *
 * A glowing brand-green button that slides in shortly after load, plus a
 * one-per-session teaser bubble ("questions? we reply in minutes") that
 * invites the first tap. Both open a wa.me chat with the store number from
 * `siteConfig.contact.phone`, prefilled so the first message identifies the
 * store. Hidden on /checkout so it can't overlap the Place order flow on
 * small screens.
 */
export function WhatsAppWidget() {
  const pathname = usePathname();
  const [entered, setEntered] = useState(false);
  const [teaserOpen, setTeaserOpen] = useState(false);

  // Slide the button in after a beat, then float the teaser up once per
  // session a few seconds later — staggered so neither fights the page load.
  useEffect(() => {
    const enter = setTimeout(() => setEntered(true), 1200);
    let teaser: ReturnType<typeof setTimeout> | undefined;
    try {
      if (window.sessionStorage.getItem(TEASER_KEY) !== '1') {
        teaser = setTimeout(() => {
          setTeaserOpen(true);
          window.sessionStorage.setItem(TEASER_KEY, '1');
        }, 5000);
      }
    } catch {
      /* storage disabled — button still works, just no teaser */
    }
    return () => {
      clearTimeout(enter);
      if (teaser) clearTimeout(teaser);
    };
  }, []);

  if (pathname.startsWith('/checkout')) return null;

  // wa.me needs the number in international format with no +, spaces, or dashes.
  const number = siteConfig.contact.phone.replace(/\D/g, '');
  const text = encodeURIComponent(
    `Hi ${siteConfig.name}! I have a question about a product on your website.`,
  );
  const chatHref = `https://wa.me/${number}?text=${text}`;

  return (
    <div
      className={`fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 transition-all duration-500 ease-out ${
        entered ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
    >
      {/* Teaser bubble */}
      <div
        className={`relative max-w-[240px] rounded-2xl rounded-br-md border border-border bg-card p-4 shadow-elevated transition-all duration-300 ease-out ${
          teaserOpen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
        aria-hidden={!teaserOpen}
      >
        <button
          type="button"
          onClick={() => setTeaserOpen(false)}
          aria-label="Dismiss chat prompt"
          className="absolute -left-2 -top-2 rounded-full border border-border bg-card p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <X className="size-3" />
        </button>
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          We&apos;re online
        </p>
        <p className="mt-1.5 font-serif text-base font-light leading-snug">
          Questions about a product? We usually reply within minutes.
        </p>
        <a
          href={chatHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setTeaserOpen(false)}
          className="mt-2.5 inline-block text-sm font-medium text-[#1faf54] transition-colors hover:text-[#178f44] dark:text-[#25D366]"
        >
          Start a chat →
        </a>
      </div>

      {/* Chat button */}
      <a
        href={chatHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-br from-[#2ce27a] to-[#1faf54] py-3.5 pl-3.5 pr-3.5 text-white shadow-[0_8px_24px_-6px_rgba(37,211,102,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-6px_rgba(37,211,102,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 active:translate-y-0 sm:pl-4 sm:pr-5"
      >
        {/* Soft attention ring until the teaser has made its pitch */}
        {!teaserOpen && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[#25D366] opacity-20 [animation-duration:2.5s]" />
        )}
        <WhatsAppIcon className="size-6 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110" />
        <span className="hidden text-sm font-medium tracking-wide sm:inline">Chat with us</span>
      </a>
    </div>
  );
}
