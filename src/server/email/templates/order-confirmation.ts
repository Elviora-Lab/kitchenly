import 'server-only';

import { siteConfig } from '@/config/site';

import { formatMoney } from '@/utils/format';

import {
  emailDetailTable,
  emailLayout,
  type EmailLineItem,
  emailLineItemsTable,
  emailNotice,
  emailParagraph,
  emailSteps,
  emailTotalsTable,
  escapeHtml,
} from './layout';

export function orderConfirmationEmail({
  orderNumber,
  orderUrl,
  total,
  currency,
  subtotal,
  shippingFee = 0,
  savings,
  savingsLabel,
  items = [],
  customerName,
  shippingAddress,
  isCod = false,
}: {
  orderNumber: string;
  orderUrl?: string;
  total: number;
  currency: string;
  subtotal?: number;
  shippingFee?: number;
  savings?: number;
  savingsLabel?: string | null;
  items?: EmailLineItem[];
  customerName?: string | null;
  shippingAddress?: string | null;
  isCod?: boolean;
}) {
  const subject = `Your ${siteConfig.name} order ${orderNumber}`;
  const greeting = customerName ? `Hi ${escapeHtml(customerName)},` : 'Hi there,';

  const bodyParts: string[] = [
    emailParagraph(
      `${greeting} we've received your order and our team is getting it ready. You'll get another email when it ships.`,
    ),
    emailDetailTable([
      {
        label: 'Order number',
        value: `<span style="font-family:monospace;">${escapeHtml(orderNumber)}</span>`,
      },
      ...(shippingAddress ? [{ label: 'Deliver to', value: shippingAddress }] : []),
    ]),
  ];

  if (items.length > 0) {
    bodyParts.push(emailLineItemsTable(items, currency, formatMoney));
  }

  const totalRows: Array<{ label: string; value: string; bold?: boolean }> = [];
  if (subtotal !== undefined) {
    totalRows.push({ label: 'Subtotal', value: formatMoney(subtotal, currency) });
  }
  if (shippingFee > 0) {
    totalRows.push({ label: 'Delivery', value: formatMoney(shippingFee, currency) });
  } else if (subtotal !== undefined) {
    totalRows.push({ label: 'Delivery', value: 'Free' });
  }
  if (savings && savings > 0) {
    const label = savingsLabel ? `Discount (${savingsLabel})` : 'Discount';
    totalRows.push({ label, value: `−${formatMoney(savings, currency)}` });
  }
  totalRows.push({ label: 'Total', value: formatMoney(total, currency), bold: true });
  bodyParts.push(emailTotalsTable(totalRows));

  if (savings && savings > 0) {
    bodyParts.push(
      emailNotice(
        `You saved <strong>${formatMoney(savings, currency)}</strong>${savingsLabel ? ` with ${escapeHtml(savingsLabel)}` : ''} on this order.`,
        'success',
      ),
    );
  }

  if (isCod) {
    bodyParts.push(
      emailNotice(
        `<strong>Cash on delivery:</strong> Please keep <strong>${formatMoney(total, currency)}</strong> ready when your parcel arrives.`,
      ),
    );
  }

  bodyParts.push(
    emailParagraph('<strong>What happens next?</strong>'),
    emailSteps([
      'We pack and quality-check your items.',
      'Your order ships via our courier partner.',
      'You receive tracking details by email.',
    ]),
  );

  const html = emailLayout({
    preheader: `Order ${orderNumber} confirmed — total ${formatMoney(total, currency)}`,
    title: 'Thank you for your order',
    bodyHtml: bodyParts.join(''),
    cta: orderUrl ? { label: 'View order details', href: orderUrl } : undefined,
  });

  const itemLines = items.map(
    (i) => `  - ${i.name} × ${i.quantity}: ${formatMoney(i.lineTotal, currency)}`,
  );
  const text = [
    `Thank you for your order at ${siteConfig.name}.`,
    `Order: ${orderNumber}`,
    `Total: ${formatMoney(total, currency)}`,
    ...(isCod ? [`Pay ${formatMoney(total, currency)} on delivery (cash on delivery).`] : []),
    ...(itemLines.length ? ['', 'Items:', ...itemLines] : []),
    ...(orderUrl ? ['', `View order: ${orderUrl}`] : []),
  ].join('\n');

  return { subject, html, text };
}

/** Build a safe HTML shipping address block from order snapshot fields. */
export function formatShippingAddressHtml(parts: {
  fullName?: string | null;
  line1?: string | null;
  line2?: string | null;
  area?: string | null;
  city?: string | null;
  postalCode?: string | null;
}): string | null {
  const lines = [
    parts.fullName,
    parts.line1,
    parts.line2,
    [parts.area, parts.city, parts.postalCode].filter(Boolean).join(', ') || null,
  ]
    .filter((line): line is string => Boolean(line?.trim()))
    .map(escapeHtml);
  return lines.length > 0 ? lines.join('<br/>') : null;
}
