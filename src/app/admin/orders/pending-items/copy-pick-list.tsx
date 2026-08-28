'use client';

import { useState, useTransition } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { displayVariant, shadeLabel } from './variant-label';

export type PickListLine = {
  productName: string;
  variantName: string | null;
  sku: string | null;
  size: string | null;
  shade: string | null;
  fragrance: string | null;
  totalQuantity: number;
};

/** Plain-text pick list — built for pasting into WhatsApp / SMS / email. */
export function formatPickList(
  lines: ReadonlyArray<PickListLine>,
  meta: { statusLabel: string; orderCount: number },
): string {
  const totalUnits = lines.reduce((sum, line) => sum + line.totalQuantity, 0);
  const header = `Pending items (${meta.statusLabel}) — ${totalUnits} unit${totalUnits === 1 ? '' : 's'} · ${lines.length} line${lines.length === 1 ? '' : 's'} · ${meta.orderCount} order${meta.orderCount === 1 ? '' : 's'}`;

  if (lines.length === 0) return `${header}\n\n(nothing to pack)`;

  const body = lines
    .map((line) => {
      const details = [
        line.size,
        shadeLabel(line.shade),
        line.fragrance,
        !line.size && !line.shade && !line.fragrance ? displayVariant(line.variantName) : null,
      ]
        .filter((part): part is string => Boolean(part) && part !== '—')
        .join(' · ');

      const name = details ? `${line.productName} (${details})` : line.productName;
      const sku = line.sku ? ` [${line.sku}]` : '';
      return `${line.totalQuantity}× ${name}${sku}`;
    })
    .join('\n');

  return `${header}\n\n${body}`;
}

export function CopyPickListButton({
  lines,
  statusLabel,
  orderCount,
}: {
  lines: PickListLine[];
  statusLabel: string;
  orderCount: number;
}) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  function onCopy() {
    const text = formatPickList(lines, { statusLabel, orderCount });
    start(async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('Pick list copied — paste it into a message');
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Could not copy — check clipboard permission');
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      loading={pending}
      disabled={lines.length === 0}
      onClick={onCopy}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : 'Copy list'}
    </Button>
  );
}
