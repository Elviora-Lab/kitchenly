import 'server-only';

import { siteConfig } from '@/config/site';

export function orderDeliveredEmail({
  orderNumber,
  orderUrl,
  reviewUrl,
}: {
  orderNumber: string;
  orderUrl?: string;
  /** Signed, no-login "leave a review" link (verified purchase). */
  reviewUrl?: string;
}) {
  const subject = `Your ${siteConfig.name} order ${orderNumber} has arrived`;
  const orderLink = orderUrl
    ? `<p style="margin-top: 32px;"><a href="${orderUrl}" style="color: #15171B; font-weight: 600;">View your order →</a></p>`
    : '';
  const reviewCta = reviewUrl
    ? `<p style="line-height: 1.6; margin-top: 24px;">Loved it? <a href="${reviewUrl}" style="color: #15171B; font-weight: 600;">Leave a quick review →</a> It takes a minute, needs no account, and helps other shoppers discover ${siteConfig.name}.</p>`
    : '';
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #15171B;">
      <h1 style="font-weight: 300; letter-spacing: 0.12em; text-transform: uppercase; font-size: 18px;">${siteConfig.name}</h1>
      <h2 style="font-weight: 300; font-size: 28px; margin: 24px 0 8px;">Delivered, with care.</h2>
      <p style="line-height: 1.6;">Order <strong>${orderNumber}</strong> has been delivered. We hope it wears like light.</p>
      <p style="line-height: 1.6; margin-top: 16px;">If anything isn't perfect, reply to this email within the return window and we'll help right away.</p>
      ${reviewCta}
      ${orderLink}
    </div>
  `;
  return { subject, html };
}
