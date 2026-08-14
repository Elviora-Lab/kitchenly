import 'server-only';

import { type ReturnStatus } from '@prisma/client';

import { siteConfig } from '@/config/site';

const COPY: Record<ReturnStatus, { heading: string; body: string }> = {
  REQUESTED: {
    heading: 'We received your return request',
    body: "Thanks — we've logged your return request and our team will review it shortly.",
  },
  APPROVED: {
    heading: 'Your return is approved',
    body: 'Your return has been approved. Please send the item(s) back; once received we will issue your refund.',
  },
  REJECTED: {
    heading: 'Update on your return request',
    body: "After review, we're unable to approve this return. Reply to this email if you have questions.",
  },
  REFUNDED: {
    heading: 'Your refund is on its way',
    body: 'Your return is complete and your refund has been processed. It may take a few business days to appear.',
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
  const { heading, body } = COPY[status];
  const subject = `${heading} — order ${orderNumber}`;
  const orderLink = orderUrl
    ? `<p style="margin-top: 32px;"><a href="${orderUrl}" style="color: #15171B; font-weight: 600;">View your order →</a></p>`
    : '';
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #15171B;">
      <h1 style="font-weight: 300; letter-spacing: 0.12em; text-transform: uppercase; font-size: 18px;">${siteConfig.name}</h1>
      <h2 style="font-weight: 300; font-size: 28px; margin: 24px 0 8px;">${heading}</h2>
      <p style="line-height: 1.6;">${body}</p>
      <p style="line-height: 1.6; margin-top: 16px;">Order: <strong>${orderNumber}</strong></p>
      ${orderLink}
    </div>
  `;
  const text = `${heading} (order ${orderNumber}). ${body}`;
  return { subject, html, text };
}
