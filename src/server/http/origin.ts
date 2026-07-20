import 'server-only';

/**
 * True when the request's `Origin` (or `Referer`) is same-origin with the host
 * that actually served the request.
 *
 * We compare against the request's OWN host — `x-forwarded-host` (set by the
 * platform proxy, e.g. Vercel) with a fallback to `host` — rather than a
 * statically configured site URL. That way every host the app is legitimately
 * served on (the production domain, the *.vercel.app alias, preview
 * deployments, a custom domain) is same-origin with itself, while a genuine
 * cross-site request is still rejected.
 *
 * This is safe for CSRF: a victim browser issuing a cross-site request to us
 * still sends OUR host in `Host`/`x-forwarded-host` (it's the URL being
 * requested) but the attacker's page in `Origin`, so the two differ and we
 * reject. An attacker who can forge these headers directly (curl) isn't a CSRF
 * vector — no victim cookies ride along.
 *
 * Browser-issued beacons (fetch/sendBeacon) always include at least one of
 * Origin/Referer; a bare scripted request (curl, bot) typically has neither.
 * Requests missing both are treated as NOT same-site — treating "no Origin" as
 * trusted would let direct scripted requests poison analytics/CAPI data.
 */
export function isSameSiteRequest(req: Request): boolean {
  // The host the request was actually served on. `x-forwarded-host` may carry a
  // proxy chain ("a, b") — the first entry is the client-facing host.
  const forwarded = req.headers.get('x-forwarded-host');
  const selfHost = (forwarded ? forwarded.split(',')[0] : req.headers.get('host'))?.trim();
  if (!selfHost) return false;

  const hostOf = (value: string): string | null => {
    try {
      return new URL(value).host;
    } catch {
      return null;
    }
  };

  const origin = req.headers.get('origin');
  if (origin) return hostOf(origin) === selfHost;
  const referer = req.headers.get('referer');
  if (referer) return hostOf(referer) === selfHost;
  return false;
}
