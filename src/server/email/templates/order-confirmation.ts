import 'server-only';

import { siteConfig } from '@/config/site';

import { formatMoney } from '@/utils/format';

export function orderConfirmationEmail({
  orderNumber,
  orderUrl,
  total,
  currency,
  savings,
  savingsLabel,
}: {
  orderNumber: string;
  orderUrl?: string;
  total: number;
  currency: string;
  /** Discount applied to this order, for a "you saved" line. */
  savings?: number;
  savingsLabel?: string | null;
}) {
  const subject = `Your ${siteConfig.name} order ${orderNumber}`;
  const orderLink = orderUrl
    ? `<p style="margin-top: 32px;"><a href="${orderUrl}" style="color: #15171B; font-weight: 600;">View your order →</a></p>`
    : '';
  const savingsLine =
    savings && savings > 0
      ? `<p style="line-height: 1.6; margin-top: 8px; color: #2e7d5b;">🎁 You saved <strong>${formatMoney(savings, currency)}</strong>${savingsLabel ? ` with ${savingsLabel}` : ''}!</p>`
      : '';
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #15171B;">
      <h1 style="font-weight: 300; letter-spacing: 0.12em; text-transform: uppercase; font-size: 18px;">${siteConfig.name}</h1>
      <h2 style="font-weight: 300; font-size: 28px; margin: 24px 0 8px;">Thank you for your order.</h2>
      <p style="line-height: 1.6;">We've received order <strong>${orderNumber}</strong> and are preparing it with care. You'll get another note when it ships.</p>
      <p style="line-height: 1.6; margin-top: 16px;">Order total: <strong>${formatMoney(total, currency)}</strong></p>
      ${savingsLine}
      ${orderLink}
    </div>
  `;
  return { subject, html };
}
