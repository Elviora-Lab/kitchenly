import { requireAdmin } from '@/server/auth/guards';
import { createHandler } from '@/server/http/handler';
import { generatePostExLoadSheet } from '@/server/shipping/postex';

export const runtime = 'nodejs';

/**
 * Stream a PostEx load sheet PDF for a pickup handoff, e.g.
 * /api/v1/admin/postex/load-sheet?tracking=CX-123,CX-456&pickupAddress=Karachi.
 * Admin-only.
 */
export const GET = createHandler(async (req) => {
  await requireAdmin(req);

  const params = new URL(req.url).searchParams;
  const trackingNumbers = (params.get('tracking') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const pickupAddress = params.get('pickupAddress')?.trim() || undefined;

  if (trackingNumbers.length === 0) {
    return new Response('Missing tracking number', { status: 400 });
  }

  try {
    const pdf = await generatePostExLoadSheet({ trackingNumbers, pickupAddress });
    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="postex-load-sheet.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch load sheet';
    return new Response(message, { status: 502 });
  }
});
