import 'server-only';

import { siteConfig } from '@/config/site';

import {
  emailBulletList,
  emailLayout,
  emailMutedParagraph,
  emailParagraph,
  escapeHtml,
} from './layout';

export function abandonedCartEmail({
  name,
  itemNames,
}: {
  name?: string | null;
  itemNames: string[];
}) {
  const subject = `You left something behind at ${siteConfig.name}`;
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';
  const previewItems = itemNames.slice(0, 6);
  const moreCount = itemNames.length - previewItems.length;

  const html = emailLayout({
    preheader: `${itemNames.length} item${itemNames.length === 1 ? '' : 's'} waiting in your bag`,
    title: 'Your bag is waiting',
    bodyHtml: [
      emailParagraph(`${greeting} you left these in your cart:`),
      emailBulletList(previewItems),
      ...(moreCount > 0
        ? [emailMutedParagraph(`…and ${moreCount} more item${moreCount === 1 ? '' : 's'}.`)]
        : []),
      emailMutedParagraph(
        'Popular items sell out fast — complete your order before they are gone.',
      ),
    ].join(''),
    cta: { label: 'Return to your bag', href: `${siteConfig.url}/cart` },
  });

  const text = `${greeting} you left ${itemNames.length} item(s) in your ${siteConfig.name} bag. Complete your order: ${siteConfig.url}/cart`;
  return { subject, html, text };
}
