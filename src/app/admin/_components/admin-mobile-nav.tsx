'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LogOut, Menu } from 'lucide-react';

import { BrandLogo } from '@/components/brand/brand-logo';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

import { AdminNav } from '@/app/admin/_components/admin-nav';
import { logoutAction } from '@/server/actions/auth.actions';

/**
 * Admin navigation for < lg screens. The desktop sidebar is hidden below lg, so
 * without this there's no way to reach any admin section on a phone/tablet.
 * Renders a sticky top bar with a hamburger that opens the full nav in a drawer.
 */
export function AdminMobileNav({ displayName, role }: { displayName: string; role: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          aria-label="Open admin menu"
          className="grid size-9 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Menu className="size-5" />
        </SheetTrigger>

        <SheetContent side="left" className="w-72 max-w-[85vw] gap-3">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>

          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-3"
            aria-label="Admin home"
          >
            <BrandLogo variant="mark" size={36} />
            <span className="font-serif text-sm font-light uppercase tracking-[0.18em] text-muted-foreground">
              / admin
            </span>
          </Link>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              Signed in
            </div>
            <div className="truncate text-sm font-medium">{displayName}</div>
            <div className="text-xs text-muted-foreground">{role}</div>
          </div>

          <AdminNav onNavigate={() => setOpen(false)} />

          <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
            >
              ← Back to store
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-destructive"
              >
                <LogOut className="size-3.5" /> Sign out
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      <Link href="/admin" className="inline-flex items-center gap-2" aria-label="Admin home">
        <BrandLogo variant="mark" size={26} />
        <span className="font-serif text-xs font-light uppercase tracking-[0.16em] text-muted-foreground">
          / admin
        </span>
      </Link>
    </header>
  );
}
