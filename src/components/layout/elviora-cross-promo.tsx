import Link from 'next/link';
import { ArrowUpRight, Sparkles } from 'lucide-react';

import { cn } from '@/lib/cn';

const ELVIORA_URL = 'https://elviora.com.pk/';

type ElvioraCrossPromoProps = {
  className?: string;
};

export function ElvioraCrossPromo({ className }: ElvioraCrossPromoProps) {
  return (
    <aside
      aria-label="Elviora beauty promotion"
      className={cn('border-b border-[#f2c67d]/25 bg-[#15100d] text-[#fff8ed]', className)}
    >
      <Link
        href={ELVIORA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex min-h-9 items-center justify-center px-4 text-center text-[11px] font-semibold tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f2c67d]"
        data-track="cta"
        data-track-label="elviora-cross-promo"
      >
        <span className="container flex min-w-0 items-center justify-center gap-2">
          <Sparkles className="size-3.5 shrink-0 text-[#f2c67d]" aria-hidden="true" />
          <span className="truncate uppercase">
            From our beauty shelf: Elviora cosmetics & skincare
          </span>
          <span className="hidden shrink-0 items-center gap-1 uppercase text-[#f2c67d] sm:inline-flex">
            Visit Elviora
            <ArrowUpRight
              className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
          <ArrowUpRight className="size-3.5 shrink-0 text-[#f2c67d] sm:hidden" aria-hidden="true" />
        </span>
      </Link>
    </aside>
  );
}
