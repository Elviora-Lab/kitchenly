import * as Sentry from '@sentry/nextjs';

/**
 * Sentry init for the Edge runtime (middleware, edge routes). Imported from
 * `instrumentation.ts`'s `register()`. No-op outside production.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isProdEnv = process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';

if (dsn && isProdEnv) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT ?? 'development',
    tracesSampleRate: 0.1,
  });
}
