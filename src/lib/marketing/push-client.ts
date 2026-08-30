'use client';

import { getApps, initializeApp } from '@firebase/app';
import { getMessaging, getToken, isSupported } from '@firebase/messaging';

import { publicEnv } from '@/config/env';

import { getAnonymousVisitorId, visitorPayload } from './visitor-client';

export function firebasePushConfigured(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY &&
    publicEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    publicEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    publicEnv.NEXT_PUBLIC_FIREBASE_APP_ID &&
    publicEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
  );
}

async function messagingClient() {
  if (!firebasePushConfigured()) return null;
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (!(await isSupported())) return null;

  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: publicEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: publicEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: publicEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: publicEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: publicEnv.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    });

  return getMessaging(app);
}

export async function requestPushSubscription(): Promise<
  { ok: true; token: string } | { ok: false; reason: string }
> {
  if (!firebasePushConfigured()) return { ok: false, reason: 'not_configured' };
  if (typeof Notification === 'undefined') return { ok: false, reason: 'not_supported' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: permission };
  }

  const messaging = await messagingClient();
  if (!messaging) return { ok: false, reason: 'not_supported' };

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await getToken(messaging, {
    vapidKey: publicEnv.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) return { ok: false, reason: 'no_token' };

  await fetch('/api/v1/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...visitorPayload(),
      anonymousId: getAnonymousVisitorId(),
      token,
      permission,
      platform: navigator.platform || null,
      pagePath: `${window.location.pathname}${window.location.search}`,
    }),
  });
  return { ok: true, token };
}
