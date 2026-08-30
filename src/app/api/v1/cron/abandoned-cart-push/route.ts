import { NextResponse } from 'next/server';

import { cronAuthError } from '@/server/http/cron';
import { pushRecoveryService } from '@/server/services/push-recovery.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = cronAuthError(req);
  if (denied) return denied;

  const result = await pushRecoveryService.sweepAbandonedCarts();
  return NextResponse.json({ ok: true, ...result });
}
