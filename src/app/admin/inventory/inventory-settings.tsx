'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { setLowStockThreshold } from '@/server/actions/admin/inventory.actions';

export function LowStockThresholdForm({ threshold }: { threshold: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(String(threshold));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="threshold">Default reorder point</Label>
        <Input
          id="threshold"
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-32"
        />
      </div>
      <Button
        size="sm"
        loading={pending}
        onClick={() =>
          start(async () => {
            const result = await setLowStockThreshold({ threshold: Number(value) });
            if (result.success) {
              toast.success('Reorder point saved');
              router.refresh();
            } else {
              toast.error(result.message);
            }
          })
        }
      >
        Save
      </Button>
      <p className="max-w-md text-xs text-muted-foreground">
        Used for any variant without its own reorder point. Set a per-variant one on the row below
        when an item sells faster or is slower to restock than the rest.
      </p>
    </div>
  );
}
