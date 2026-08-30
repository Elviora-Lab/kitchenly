import 'server-only';

import { type App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

import { serverEnv } from '@/config/env';

type PushMessage = {
  token: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  data?: Record<string, string>;
};

type ServiceAccountFields = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

/**
 * Same credentials you'd pass to:
 *   admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
 *
 * Prefer one of:
 * - `FCM_SERVICE_ACCOUNT_JSON` — full service-account JSON as a single secret
 * - or `FCM_PROJECT_ID` + `FCM_CLIENT_EMAIL` + `FCM_PRIVATE_KEY`
 */
function resolveServiceAccount(): ServiceAccountFields | null {
  const rawJson = serverEnv.FCM_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, '\n'),
        };
      }
      console.warn('[fcm] FCM_SERVICE_ACCOUNT_JSON is missing project_id/client_email/private_key');
    } catch {
      console.warn('[fcm] FCM_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
  }

  if (serverEnv.FCM_PROJECT_ID && serverEnv.FCM_CLIENT_EMAIL && serverEnv.FCM_PRIVATE_KEY) {
    return {
      projectId: serverEnv.FCM_PROJECT_ID,
      clientEmail: serverEnv.FCM_CLIENT_EMAIL,
      privateKey: serverEnv.FCM_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

export function fcmEnabled(): boolean {
  return resolveServiceAccount() !== null;
}

function getAdminApp(): App | null {
  const account = resolveServiceAccount();
  if (!account) return null;

  const existing = getApps()[0];
  if (existing) return existing;

  return initializeApp({
    credential: cert({
      projectId: account.projectId,
      clientEmail: account.clientEmail,
      privateKey: account.privateKey,
    }),
    projectId: account.projectId,
  });
}

export async function sendFcmPush(message: PushMessage): Promise<boolean> {
  const app = getAdminApp();
  if (!app) return false;

  const link = message.url ?? '/';
  try {
    await getMessaging(app).send({
      token: message.token,
      notification: {
        title: message.title,
        body: message.body,
        imageUrl: message.icon,
      },
      webpush: {
        fcmOptions: { link },
        notification: {
          icon: message.icon ?? '/icon.png',
          badge: '/icon.png',
        },
      },
      data: {
        url: link,
        ...(message.icon ? { icon: message.icon } : {}),
        ...(message.data ?? {}),
      },
    });
    return true;
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : '';
    // Dead tokens should be pruned by the caller when we surface this; for now
    // log and treat as a failed delivery so the sweep can move on.
    console.warn('[fcm] push failed', code || (error instanceof Error ? error.message : error));
    return false;
  }
}
