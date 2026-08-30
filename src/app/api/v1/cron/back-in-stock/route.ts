import { NextResponse } from 'next/server';

import { cronAuthError } from '@/server/http/cron';
import { syncPostExShipments } from '@/server/services/postex-sync.service';
import { productPushService } from '@/server/services/product-push.service';
import { stockNotifyService } from '@/server/services/stock-notify.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = cronAuthError(req);
  if (denied) return denied;

  const [email, push] = await Promise.all([
    stockNotifyService.sweepRestocked(),
    productPushService.sweepBackInStock(),
  ]);
  // Piggyback the daily PostEx status reconciliation here so it runs on a
  // schedule without spending an extra cron slot.
  const postex = await syncPostExShipments();
  return NextResponse.json({ ok: true, email, push, postex });
}
