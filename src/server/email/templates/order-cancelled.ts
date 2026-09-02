import 'server-only';

import { siteConfig } from '@/config/site';

import { emailLayout, emailNotice, emailParagraph, escapeHtml } from './layout';

export function orderCancelledEmail({
  orderNumber,
  wasPaid = false,
}: {
  orderNumber: string;
  /** When true, mention refund processing for card/online payments. */
  wasPaid?: boolean;
}) {
  const subject = `Your ${siteConfig.name} order ${orderNumber} was cancelled`;
  const refundNote = wasPaid
    ? emailNotice(
        'If you already paid online, your refund will be processed to your original payment method within a few business days.',
      )
    : '';

  const html = emailLayout({
    preheader: `Order ${orderNumber} has been cancelled`,
    title: 'Order cancelled',
    bodyHtml: [
      emailParagraph(
        `Order <strong>${escapeHtml(orderNumber)}</strong> has been cancelled as requested.`,
      ),
      refundNote,
      emailParagraph(
        "If you didn't request this cancellation, reply to this email right away and we'll investigate.",
      ),
    ].join(''),
    cta: { label: 'Continue shopping', href: `${siteConfig.url}/products` },
  });

  const text = [
    `Your ${siteConfig.name} order ${orderNumber} was cancelled.`,
    ...(wasPaid
      ? ['A refund will be issued to your original payment method if payment was received.']
      : []),
    `Shop again: ${siteConfig.url}/products`,
  ].join('\n');

  return { subject, html, text };
}
