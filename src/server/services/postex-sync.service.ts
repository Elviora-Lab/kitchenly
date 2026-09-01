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

/** Never regress shipment status when PostEx returns a stale/ambiguous payload. */
const SHIPMENT_RANK: Record<ShipmentStatus, number> = {
  [ShipmentStatus.PENDING]: 0,
  [ShipmentStatus.LABEL_CREATED]: 1,
  [ShipmentStatus.IN_TRANSIT]: 2,
  [ShipmentStatus.OUT_FOR_DELIVERY]: 3,
  [ShipmentStatus.DELIVERED]: 4,
  [ShipmentStatus.RETURNED]: 4,
  [ShipmentStatus.FAILED]: 4,
};

type ShipmentRow = {
  id: string;
  trackingNumber: string | null;
  shipmentStatus: ShipmentStatus;
  shippedAt: Date | null;
  orderId: string;
  order: { orderStatus: OrderStatus };
};

export type PostExSyncResult = {
  checked: number;
  updated: number;
  shipped: number;
  delivered: number;
  returned: number;
  errors: number;
};

type ReconcileResult = {
  status: string;
  updated: boolean;
  shipped: boolean;
  delivered: boolean;
  returned: boolean;
  error: boolean;
};

function impliesOrderShipped(mapped: ReturnType<typeof mapPostExStatus> | null): boolean {
  return mapped?.order === OrderStatus.SHIPPED && !mapped.terminal;
}

async function reconcilePostExShipment(s: ShipmentRow): Promise<ReconcileResult> {
  const outcome: ReconcileResult = {
    status: 'Unknown',
    updated: false,
    shipped: false,
    delivered: false,
    returned: false,
    error: false,
  };

  if (!s.trackingNumber) return outcome;

  let statusRaw = 'Unknown';
  let mapped: ReturnType<typeof mapPostExStatus> | null = null;

  try {
    const tracked = await trackPostExOrder(s.trackingNumber);
    statusRaw = tracked.status;
    mapped = mapPostExStatus(statusRaw);
    outcome.status = statusRaw;
  } catch {
    outcome.error = true;
    return outcome;
  }

  const markShipped = impliesOrderShipped(mapped);

  const shipmentPatch: {
    shipmentStatus?: ShipmentStatus;
    shippedAt?: Date;
    deliveredAt?: Date;
  } = {};

  if (mapped && SHIPMENT_RANK[mapped.shipment] > SHIPMENT_RANK[s.shipmentStatus]) {
    shipmentPatch.shipmentStatus = mapped.shipment;
  }
  if (mapped?.shipment === ShipmentStatus.DELIVERED) shipmentPatch.deliveredAt = new Date();
  if (markShipped && !s.shippedAt) shipmentPatch.shippedAt = new Date();

  if (Object.keys(shipmentPatch).length > 0) {
    await prisma.shipment.update({ where: { id: s.id }, data: shipmentPatch });
    outcome.updated = true;
  }

  if (markShipped && AWAITING_PICKUP.includes(s.order.orderStatus)) {
    const { changed } = await transitionOrder(
      s.orderId,
      OrderStatus.SHIPPED,
      `PostEx: ${statusRaw}`,
    );
    outcome.shipped = changed;
  }

  if (mapped?.terminal && mapped.order) {
    await transitionOrder(s.orderId, mapped.order, `PostEx: ${statusRaw}`);
    if (mapped.order === OrderStatus.DELIVERED) outcome.delivered = true;
    if (mapped.order === OrderStatus.RETURNED) outcome.returned = true;
  }

  return outcome;
}

/**
 * Poll PostEx for every open consignment and reconcile our records: update the
 * shipment status, mark orders SHIPPED only when PostEx reports "Picked By PostEx",
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
    orderBy: { id: 'asc' },
    take: 200,
  });

  const result: PostExSyncResult = {
    checked: 0,
    updated: 0,
    shipped: 0,
    delivered: 0,
    returned: 0,
    errors: 0,
  };

  for (const s of shipments) {
    if (!s.trackingNumber) continue;
    result.checked += 1;
    const row = await reconcilePostExShipment(s);
    if (row.error) result.errors += 1;
    if (row.updated) result.updated += 1;
    if (row.shipped) result.shipped += 1;
    if (row.delivered) result.delivered += 1;
    if (row.returned) result.returned += 1;
  }

  return result;
}

/** Reconcile one PostEx shipment — used by admin "Refresh status". */
export async function syncPostExOrder(orderId: string): Promise<{
  status: string;
  orderStatus: OrderStatus;
  shipped: boolean;
}> {
  const shipment = await prisma.shipment.findFirst({
    where: { orderId, courierName: 'PostEx', trackingNumber: { not: null } },
    select: {
      id: true,
      trackingNumber: true,
      shipmentStatus: true,
      shippedAt: true,
      orderId: true,
      order: { select: { orderStatus: true } },
    },
  });
  if (!shipment?.trackingNumber) throw new Error('No PostEx shipment found for this order');

  const row = await reconcilePostExShipment(shipment);
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { orderStatus: true },
  });

  return {
    status: row.status,
    orderStatus: order.orderStatus,
    shipped: row.shipped,
  };
}
