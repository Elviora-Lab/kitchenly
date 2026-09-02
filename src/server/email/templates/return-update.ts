import 'server-only';

import { type ReturnStatus } from '@prisma/client';

import { siteConfig } from '@/config/site';

import { emailLayout, emailNotice, emailParagraph, escapeHtml } from './layout';

const COPY: Record<ReturnStatus, { heading: string; body: string; tone?: 'info' | 'success' }> = {
  REQUESTED: {
    heading: 'Return request received',
    body: "We've logged your return request. Our team will review it and get back to you shortly — usually within 1–2 business days.",
  },
  APPROVED: {
    heading: 'Return approved',
    body: 'Your return has been approved. Please send the item(s) back in their original packaging. Once we receive and inspect them, we will process your refund.',
    tone: 'success',
  },
  REJECTED: {
    heading: 'Update on your return',
    body: "After reviewing your request, we're unable to approve this return. Reply to this email if you have questions or believe this was a mistake.",
  },
  REFUNDED: {
    heading: 'Refund processed',
    body: 'Your return is complete and your refund has been issued. It may take a few business days to appear on your statement or in your account.',
    tone: 'success',
  },
};

export function returnUpdateEmail({
  orderNumber,
  orderUrl,
  status,
}: {
  orderNumber: string;
  orderUrl?: string;
  status: ReturnStatus;
}) {
  const { heading, body, tone } = COPY[status];
  const subject = `${heading} — order ${orderNumber}`;
  const html = emailLayout({
    preheader: `${heading} for order ${orderNumber}`,
    title: heading,
    bodyHtml: [
      emailParagraph(body),
      emailNotice(`Order: <strong>${escapeHtml(orderNumber)}</strong>`, tone ?? 'info'),
      emailParagraph('Need help? Reply to this email and our support team will assist you.'),
    ].join(''),
    cta: orderUrl ? { label: 'View your order', href: orderUrl } : undefined,
  });
  const text = `${heading} (order ${orderNumber}). ${body}`;
  return { subject, html, text };
}
