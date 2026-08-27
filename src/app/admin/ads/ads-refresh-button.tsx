'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { refreshAdsPerformance } from './actions';

export function AdsRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() => {
        startTransition(async () => {
          await refreshAdsPerformance();
          router.refresh();
        });
      }}
      aria-label="Refresh ad performance"
      title="Refresh ad performance"
    >
      {pending ? null : <RefreshCw className="size-4" aria-hidden="true" />}
      Refresh
    </Button>
  );
}
