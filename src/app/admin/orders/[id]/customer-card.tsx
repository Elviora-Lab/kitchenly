'use client';

import { useState } from 'react';
import { Check, Copy, Mail, Phone, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

/**
 * Everything needed to contact the buyer and deliver the box.
 *
 * Reads from the order's own shipping snapshot rather than the linked account,
 * for two reasons: guest checkouts have no account at all (they previously
 * rendered as a bare "Guest checkout" with no way to reach the customer), and
 * the snapshot is immutable — a registered shopper who later edits their
 * profile must not retroactively change where a past order was sent.
 */

export type CustomerCardProps = {
  account: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  shipping: {
    fullName: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    area: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  };
};

function Row({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 break-words">
        {icon}
        {children}
      </span>
    </div>
  );
}

export function CustomerCard({ account, shipping }: CustomerCardProps) {
  const [copied, setCopied] = useState(false);

  const accountName = account
    ? [account.firstName, account.lastName].filter(Boolean).join(' ').trim()
    : '';
  const name = shipping.fullName || accountName || null;
  const email = shipping.email || account?.email || null;
  const phone = shipping.phone;

  const addressLines = [
    shipping.addressLine1,
    shipping.addressLine2,
    [shipping.area, shipping.city].filter(Boolean).join(', '),
    [shipping.postalCode, shipping.country].filter(Boolean).join(' '),
  ]
    .map((l) => l?.trim())
    .filter((l): l is string => Boolean(l));

  // One block a courier form can take verbatim — retyping an address by hand is
  // where mis-deliveries come from.
  function copyAll() {
    const block = [name, phone, email, ...addressLines].filter(Boolean).join('\n');
    void navigator.clipboard.writeText(block).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const hasAnything = name || email || phone || addressLines.length > 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={account ? 'success' : 'muted'}>
          {account ? 'Registered' : 'Guest checkout'}
        </Badge>
        {hasAnything ? (
          <button
            type="button"
            onClick={copyAll}
            className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        ) : null}
      </div>

      {!hasAnything ? (
        // Pre-snapshot orders (the columns are nullable for backward compat).
        <p className="text-muted-foreground">No delivery details were captured for this order.</p>
      ) : null}

      {name ? (
        <Row label="Name" icon={<User className="size-3.5 shrink-0 text-muted-foreground" />}>
          <span className="font-medium">{name}</span>
        </Row>
      ) : null}

      {phone ? (
        <Row label="Mobile" icon={<Phone className="size-3.5 shrink-0 text-muted-foreground" />}>
          <a href={`tel:${phone.replace(/\s+/g, '')}`} className="font-medium hover:underline">
            {phone}
          </a>
        </Row>
      ) : null}

      {email ? (
        <Row label="Email" icon={<Mail className="size-3.5 shrink-0 text-muted-foreground" />}>
          <a href={`mailto:${email}`} className="break-all hover:underline">
            {email}
          </a>
        </Row>
      ) : null}

      {addressLines.length > 0 ? (
        <Row label="Delivery address">
          <span className="flex flex-col">
            {addressLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        </Row>
      ) : null}
    </div>
  );
}
