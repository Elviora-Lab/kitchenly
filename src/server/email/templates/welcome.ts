import 'server-only';

import { siteConfig } from '@/config/site';

import { emailBulletList, emailLayout, emailParagraph, escapeHtml } from './layout';

export function welcomeEmail({ name }: { name: string }) {
  const subject = `Welcome to ${siteConfig.name}`;
  const html = emailLayout({
    preheader: `${siteConfig.tagline} — delivered across Pakistan with cash on delivery`,
    title: `Welcome, ${name}`,
    bodyHtml: [
      emailParagraph(
        `Thanks for creating your ${escapeHtml(siteConfig.name)} account. From kitchen organizers to everyday home essentials, we've curated practical picks for smarter living.`,
      ),
      emailParagraph('<strong>Why shop with us?</strong>'),
      emailBulletList([
        'Cash on delivery nationwide',
        'Curated home & kitchen essentials',
        'Easy returns — just reply to any order email',
      ]),
    ].join(''),
    cta: { label: 'Start shopping', href: `${siteConfig.url}/products` },
  });

  const text = [
    `Welcome to ${siteConfig.name}, ${name}!`,
    siteConfig.description,
    `Shop now: ${siteConfig.url}/products`,
  ].join('\n');

  return { subject, html, text };
}
