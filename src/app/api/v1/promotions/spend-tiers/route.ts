import { createHandler } from '@/server/http/handler';
import { apiSuccess } from '@/server/http/response';
import { promotionsService } from '@/server/services/promotions.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public: the active "Spend & Save" tiers for the storefront rewards nudge.
 * Returns an empty array when the feature is off, so the client simply renders
 * nothing. The discount itself is always recomputed authoritatively server-side
 * at order time (`ordersService.createFromCart`).
 *
 * Do not cache this route at the Next layer: the service has its own admin-
 * invalidated cache, and cart/checkout should see tier edits immediately after
 * the admin action clears it.
 */
export const GET = createHandler(async () => {
  const tiers = await promotionsService.tiersForDisplay();
  return apiSuccess({ tiers });
});
