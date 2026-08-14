import * as Sentry from '@sentry/nextjs';

/**
 * Sentry init for the browser. Next.js auto-loads this file on the client.
 * No-op outside production so local development never emits to the production
 * Sentry project, even if a DSN is present in the environment.
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

// Required for Sentry to capture client-side navigation transactions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
