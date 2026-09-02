import 'server-only';

import { siteConfig } from '@/config/site';

import { emailLayout, emailMutedParagraph, emailParagraph } from './layout';

export function passwordResetEmail({ resetUrl }: { resetUrl: string }) {
  const subject = `Reset your ${siteConfig.name} password`;
  const html = emailLayout({
    preheader: 'Reset your password — link expires in 30 minutes',
    title: 'Reset your password',
    bodyHtml: [
      emailParagraph(
        'We received a request to reset your password. Click the button below to choose a new one. This link expires in <strong>30 minutes</strong>.',
      ),
      emailMutedParagraph(
        "If you didn't request this, you can safely ignore this email — your password won't change.",
      ),
      emailMutedParagraph(`<span style="word-break:break-all;">${resetUrl}</span>`),
    ].join(''),
    cta: { label: 'Set a new password', href: resetUrl },
    footerNote: 'For security, this link can only be used once.',
  });

  const text = `Reset your ${siteConfig.name} password (link expires in 30 minutes): ${resetUrl}`;
  return { subject, html, text };
}
