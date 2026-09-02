import 'server-only';

import { Resend } from 'resend';

import { serverEnv } from '@/config/env';
import { isDev } from '@/config/env';
import { siteConfig } from '@/config/site';

let cached: Resend | null = null;

function client(): Resend | null {
  if (!serverEnv.RESEND_API_KEY) return null;
  if (cached) return cached;
  cached = new Resend(serverEnv.RESEND_API_KEY);
  return cached;
}

const DEFAULT_FROM = `${siteConfig.name} <${siteConfig.contact.email}>`;

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

/**
 * Send an email via Resend.
 * In development (or when Resend is not configured), the email is logged to
 * the console — never silently swallowed.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string | null }> {
  const resend = client();
  if (!resend) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[email:dev]', input.subject, '→', input.to);
    } else {
      // eslint-disable-next-line no-console
      console.warn('[email] RESEND_API_KEY is not configured; email was not sent');
    }
    return { id: null };
  }
  const result = await resend.emails.send({
    from: input.from ?? serverEnv.EMAIL_FROM ?? DEFAULT_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo ?? serverEnv.EMAIL_REPLY_TO,
  });

  if (result.error) {
    const detail = result.error.message ?? JSON.stringify(result.error);
    // eslint-disable-next-line no-console
    console.error('[email] Resend rejected send:', detail, '→', input.to);
    if (isDev) {
      throw new Error(`Resend: ${detail}`);
    }
  }

  return { id: result.data?.id ?? null };
}

export function isEmailConfigured(): boolean {
  return Boolean(serverEnv.RESEND_API_KEY);
}
