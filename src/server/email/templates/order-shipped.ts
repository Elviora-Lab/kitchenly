import 'server-only';

import { siteConfig } from '@/config/site';

export function orderShippedEmail({
  orderNumber,
  orderUrl,
  courierName,
  trackingNumber,
}: {
  orderNumber: string;
  orderUrl?: string;
  courierName?: string | null;
  trackingNumber?: string | null;
}) {
  const subject = `Your ${siteConfig.name} order ${orderNumber} is on its way`;
  const orderLink = orderUrl
    ? `<p style="margin-top: 32px;"><a href="${orderUrl}" style="color: #15171B; font-weight: 600;">View your order →</a></p>`
    : '';
  const trackingBlock = trackingNumber
    ? `<p style="line-height: 1.6; margin-top: 16px;">Courier: <strong>${courierName ?? '—'}</strong><br/>Tracking number: <strong style="font-family: monospace;">${trackingNumber}</strong></p>`
    : '';
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #15171B;">
      <h1 style="font-weight: 300; letter-spacing: 0.12em; text-transform: uppercase; font-size: 18px;">${siteConfig.name}</h1>
      <h2 style="font-weight: 300; font-size: 28px; margin: 24px 0 8px;">It's on its way.</h2>
      <p style="line-height: 1.6;">Order <strong>${orderNumber}</strong> has shipped and is travelling to you now.</p>
      ${trackingBlock}
      ${orderLink}
    </div>
  `;
  return { subject, html };
}
