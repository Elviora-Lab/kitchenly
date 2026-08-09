import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { z } from 'zod';

import { ADMIN_PREFIXES, AUTH_ROUTES, PROTECTED_PREFIXES } from '@/config/routes';

const ACCESS_COOKIE = 'elv_at';

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'STAFF']);

// Payload shape is validated, not cast — a correctly-signed token with a
// malformed payload fails closed (treated as unauthenticated).
const claimsSchema = z.object({
  sub: z.string().min(1),
  role: z.string().min(1),
  email: z.string().min(1),
});

function getSecret() {
  const raw = process.env.JWT_SECRET;
  if (!raw) return null;
  return new TextEncoder().encode(raw);
}

async function verify(token: string) {
  const secret = getSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: 'kitchenly',
      audience: 'kitchenly:access',
    });
    const parsed = claimsSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Edge middleware — runs before every matched request.
 *
 * Verifies the access-token cookie with jose (Edge-compatible). The verified
 * JWT is the ONLY source of truth for both authentication and role. The
 * client-supplied `elv_role` cookie is never trusted for authorization — it is
 * a UI hint only. If `JWT_SECRET` is unset, `verify` returns null for every
 * token, so the gate fails closed (protected/admin routes redirect to login).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Customer accounts and self-registration are disabled — the storefront is
  // guest-only. Bounce these routes to the shop before any rendering (no auth
  // checks). Admin auth is unaffected.
  //
  // 308, not the default 307: these routes are gone for good, and a permanent
  // redirect is what tells Google to drop the old URLs from the index and pass
  // any accumulated signals to the destination. A temporary redirect leaves
  // them lingering as indexable candidates indefinitely.
  if (pathname === '/account' || pathname.startsWith('/account/') || pathname === '/register') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url, 308);
  }

  const token = req.cookies.get(ACCESS_COOKIE)?.value;

  const claims = token ? await verify(token) : null;
  const isAuthed = !!claims;
  const role = claims?.role ?? null;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdmin = ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname === p);

  if (isAuthed && isAuthRoute) {
    const url = req.nextUrl.clone();
    // Only admins have a destination now (the customer /account is gone).
    url.pathname = role && ADMIN_ROLES.has(role) ? '/admin' : '/';
    return NextResponse.redirect(url);
  }

  if (isProtected && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (isAdmin) {
    if (!isAuthed) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    if (!role || !ADMIN_ROLES.has(role)) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|images|fonts|api/).*)',
  ],
};
