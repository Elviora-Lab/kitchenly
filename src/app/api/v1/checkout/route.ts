import { getSession } from '@/server/auth/get-session';
import { createHandler } from '@/server/http/handler';
import { apiSuccess } from '@/server/http/response';
import { addressesService } from '@/server/services/addresses.service';

export const runtime = 'nodejs';

/**
 * Checkout context — returns the data the checkout page needs in one shot.
 * The actual `placeOrder` mutation runs through the Server Action at
 * `@/server/actions/checkout.actions`, not through this REST endpoint.
 */
export const GET = createHandler(async (req) => {
  const session = await getSession(req);
  const addresses = session ? await addressesService.list(session.sub) : [];
  return apiSuccess({ addresses });
});
