'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only overlays that appear after the page is interactive (exit-intent),
 * loaded with `ssr: false` so their JS is deferred out of the first-load bundle.
 */
export const ExitIntentNudge = dynamic(
  () => import('./exit-intent-nudge').then((m) => m.ExitIntentNudge),
  { ssr: false },
);

export const PushPermissionNudge = dynamic(
  () => import('@/components/marketing/push-permission-nudge').then((m) => m.PushPermissionNudge),
  { ssr: false },
);
