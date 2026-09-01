import 'server-only';

import { OrderStatus, ShipmentStatus } from '@prisma/client';

import { prisma } from '@/lib/db';

import { transitionOrder } from '@/server/services/order-transitions.service';
import { mapPostExStatus, trackPostExOrder } from '@/server/shipping/postex';

/** Shipment states we no longer poll — the parcel's journey is over. */
const TERMINAL: ShipmentStatus[] = [
  ShipmentStatus.DELIVERED,
  ShipmentStatus.RETURNED,
  ShipmentStatus.FAILED,
];

/** Order statuses that may advance to SHIPPED when PostEx confirms pickup. */
const AWAITING_PICKUP: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PROCESSING];

export type PostExSyncResult = {
  checked: number;
  updated: number;
  shipped: number;
  delivered: number;
  returned: number;
};

/**
 * Poll PostEx for every open consignment and reconcile our records: update the
 * shipment status, mark orders SHIPPED once PostEx confirms pickup, and when a
 * parcel reaches a terminal step transition the order (Delivered → notify the
 * customer; Returned → restock). Idempotent — a status that hasn't moved writes
 * nothing, and `transitionOrder` no-ops on an unchanged status.
 */
export async function syncPostExShipments(): Promise<PostExSyncResult> {
  const shipments = await prisma.shipment.findMany({
    where: {
      courierName: 'PostEx',
      trackingNumber: { not: null },
      shipmentStatus: { notIn: TERMINAL },
    },
    select: {
      id: true,
      trackingNumber: true,
      shipmentStatus: true,
      shippedAt: true,
      orderId: true,
      order: { select: { orderStatus: true } },
    },
    take: 200,
  });

  const result: PostExSyncResult = {
    checked: 0,
    updated: 0,
    shipped: 0,
    delivered: 0,
    returned: 0,
  };

  for (const s of shipments) {
    if (!s.trackingNumber) continue;
    result.checked += 1;
    try {
      const { status } = await trackPostExOrder(s.trackingNumber);
      const mapped = mapPostExStatus(status);
      const impliesShipped = mapped.order === OrderStatus.SHIPPED && !mapped.terminal;

      const shipmentPatch: {
        shipmentStatus?: ShipmentStatus;
        shippedAt?: Date;
        deliveredAt?: Date;
      } = {};

      if (mapped.shipment !== s.shipmentStatus) shipmentPatch.shipmentStatus = mapped.shipment;
      if (mapped.shipment === ShipmentStatus.DELIVERED) shipmentPatch.deliveredAt = new Date();
      if (impliesShipped && !s.shippedAt) shipmentPatch.shippedAt = new Date();

      if (Object.keys(shipmentPatch).length > 0) {
        await prisma.shipment.update({ where: { id: s.id }, data: shipmentPatch });
        result.updated += 1;
      }

      if (impliesShipped && AWAITING_PICKUP.includes(s.order.orderStatus)) {
        const { changed } = await transitionOrder(
          s.orderId,
          OrderStatus.SHIPPED,
          `PostEx: ${status}`,
        );
        if (changed) result.shipped += 1;
      }

      if (mapped.terminal && mapped.order) {
        await transitionOrder(s.orderId, mapped.order, `PostEx: ${status}`);
        if (mapped.order === OrderStatus.DELIVERED) result.delivered += 1;
        if (mapped.order === OrderStatus.RETURNED) result.returned += 1;
      }
    } catch {
      // Best-effort sweep: one courier hiccup shouldn't abort the rest.
    }
  }

  return result;
}
