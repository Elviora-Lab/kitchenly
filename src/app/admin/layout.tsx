import Link from 'next/link';
import { LogOut } from 'lucide-react';

import { BrandLogo } from '@/components/brand/brand-logo';

import { AdminMobileNav } from '@/app/admin/_components/admin-mobile-nav';
import { AdminNav } from '@/app/admin/_components/admin-nav';
import { logoutAction } from '@/server/actions/auth.actions';
import { requireAdmin } from '@/server/auth/guards';
import { usersRepo } from '@/server/repositories/users.repo';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Edge middleware already gates /admin, but enforce again at the layer that
  // reads the DB — defence in depth + gives us the full user object.
  const session = await requireAdmin();
  const user = await usersRepo.findById(session.sub);
  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
    : session.email;

  return (
    <div className="grid min-h-screen bg-muted/30 lg:grid-cols-[260px_1fr]">
      {/* Mobile-only top bar + drawer; hidden at lg where the sidebar returns. */}
      <AdminMobileNav displayName={displayName} role={session.role} />
      <aside className="sticky top-0 hidden h-screen flex-col gap-2 border-r border-border bg-card p-6 lg:flex">
        <Link href="/admin" className="mb-2 inline-flex items-center gap-3" aria-label="Admin home">
          <BrandLogo variant="mark" size={40} />
          <span className="font-serif text-sm font-light uppercase tracking-[0.18em] text-muted-foreground">
            / admin
          </span>
        </Link>

        <div className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2">
          <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Signed in</div>
          <div className="truncate text-sm font-medium">{displayName}</div>
          <div className="text-xs text-muted-foreground">{session.role}</div>
        </div>

        <AdminNav />

        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          <Link
            href="/"
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
      </aside>
      <main className="px-6 py-10 lg:px-10">{children}</main>
    </div>
  );
}
