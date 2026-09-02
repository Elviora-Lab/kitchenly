import 'server-only';

import { siteConfig } from '@/config/site';

import {
  emailDetailTable,
  emailLayout,
  emailNotice,
  emailParagraph,
  emailSteps,
  escapeHtml,
} from './layout';

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
  const bodyParts: string[] = [
    emailParagraph(
      `Great news — order <strong>${escapeHtml(orderNumber)}</strong> has left our warehouse and is on its way to you.`,
    ),
  ];

  if (trackingNumber) {
    bodyParts.push(
      emailNotice(
        `<strong>Tracking number</strong><br/>
        <span style="font-family:monospace;font-size:16px;letter-spacing:0.04em;">${escapeHtml(trackingNumber)}</span>
        ${courierName ? `<br/><span style="font-size:13px;color:#5c6b7a;">Courier: ${escapeHtml(courierName)}</span>` : ''}`,
        'success',
      ),
      emailDetailTable([
        { label: 'Order', value: escapeHtml(orderNumber) },
        { label: 'Courier', value: escapeHtml(courierName ?? 'Our delivery partner') },
        {
          label: 'Tracking',
          value: `<span style="font-family:monospace;">${escapeHtml(trackingNumber)}</span>`,
        },
      ]),
    );
  } else {
    bodyParts.push(
      emailParagraph(
        'Your parcel is in transit. Tracking details will be shared if available from the courier.',
      ),
    );
  }

  bodyParts.push(
    emailParagraph('<strong>While you wait</strong>'),
    emailSteps([
      'Keep your phone handy — the courier may call before delivery.',
      'Have your ID ready if required by the courier.',
      'For COD orders, keep the exact amount ready at the door.',
    ]),
  );

  const html = emailLayout({
    preheader: trackingNumber
      ? `Order ${orderNumber} shipped — tracking ${trackingNumber}`
      : `Order ${orderNumber} has shipped`,
    title: "It's on its way",
    bodyHtml: bodyParts.join(''),
    cta: orderUrl ? { label: 'Track your order', href: orderUrl } : undefined,
  });

  const text = [
    `Your ${siteConfig.name} order ${orderNumber} has shipped.`,
    ...(trackingNumber ? [`Tracking: ${trackingNumber}`, `Courier: ${courierName ?? '—'}`] : []),
    ...(orderUrl ? [`View order: ${orderUrl}`] : []),
  ].join('\n');

  return { subject, html, text };
}
