import 'server-only';

import { JWT } from 'google-auth-library';

import { serverEnv } from '@/config/env';

type PushMessage = {
  token: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  data?: Record<string, string>;
};

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export function fcmEnabled(): boolean {
  return Boolean(
    serverEnv.FCM_PROJECT_ID && serverEnv.FCM_CLIENT_EMAIL && serverEnv.FCM_PRIVATE_KEY,
  );
}

function privateKey(): string {
  return (serverEnv.FCM_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
}

async function accessToken(): Promise<string | null> {
  if (!fcmEnabled()) return null;
  const client = new JWT({
    email: serverEnv.FCM_CLIENT_EMAIL,
    key: privateKey(),
    scopes: [SCOPE],
  });
  const token = await client.getAccessToken();
  return typeof token === 'string' ? token : (token.token ?? null);
}

export async function sendFcmPush(message: PushMessage): Promise<boolean> {
  const token = await accessToken();
  if (!token || !serverEnv.FCM_PROJECT_ID) return false;

  const payload = {
    message: {
      token: message.token,
      notification: {
        title: message.title,
        body: message.body,
      },
      webpush: {
        fcm_options: {
          link: message.url ?? '/',
        },
        notification: {
          icon: message.icon ?? '/icon.png',
          badge: '/icon.png',
        },
      },
      data: {
        url: message.url ?? '/',
        ...(message.icon ? { icon: message.icon } : {}),
        ...(message.data ?? {}),
      },
    },
  };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${serverEnv.FCM_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[fcm] push rejected', res.status, text.slice(0, 300));
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[fcm] push failed', error instanceof Error ? error.message : error);
    return false;
  }
}
