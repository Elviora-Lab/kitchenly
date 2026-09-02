import 'server-only';

import { siteConfig } from '@/config/site';

import { emailLayout, emailParagraph, escapeHtml } from './layout';

export function backInStockEmail({
  productName,
  productSlug,
}: {
  productName: string;
  productSlug: string;
}) {
  const url = `${siteConfig.url}/products/${productSlug}`;
  const subject = `${productName} is back in stock`;
  const html = emailLayout({
    preheader: `${productName} is available again at ${siteConfig.name}`,
    title: "It's back in stock",
    bodyHtml: emailParagraph(
      `<strong>${escapeHtml(productName)}</strong> is available again. Stock is limited — grab it before it sells out.`,
    ),
    cta: { label: 'Shop now', href: url },
  });
  const text = `${productName} is back in stock at ${siteConfig.name}: ${url}`;
  return { subject, html, text };
}
