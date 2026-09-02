import 'server-only';

import { OrderStatus, ShipmentStatus } from '@prisma/client';

import { prisma } from '@/lib/db';

import { transitionOrder } from '@/server/services/order-transitions.service';
import {
  getPostExTrackingDetail,
  hasPostExPickupInTracking,
  isPostExPostPickupStatus,
  isPostExPrePickupStatus,
  mapPostExStatus,
  resolvePostExCurrentStatus,
  resolvePostExJourneyText,
} from '@/server/shipping/postex';

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
  trackingStatusText: string | null;
  trackingJourney: string | null;
  shippedAt: Date | null;
  orderId: string;
  order: { orderNumber: string; orderStatus: OrderStatus };
};

export type PostExSyncResult = {
  checked: number;
  updated: number;
  shipped: number;
  delivered: number;
  returned: number;
  errors: number;
  errorDetails: Array<{
    orderNumber: string;
    trackingNumber: string;
    message: string;
  }>;
};

type ReconcileResult = {
  status: string;
  journey: string | null;
  updated: boolean;
  shipped: boolean;
  delivered: boolean;
  returned: boolean;
  error: boolean;
  errorMessage?: string;
};

async function reconcilePostExShipment(s: ShipmentRow): Promise<ReconcileResult> {
  const outcome: ReconcileResult = {
    status: 'Unknown',
    journey: null,
    updated: false,
    shipped: false,
    delivered: false,
    returned: false,
    error: false,
  };

  if (!s.trackingNumber) return outcome;

  let statusRaw = 'Unknown';
  let journeyRaw: string | null = null;
  let mapped: ReturnType<typeof mapPostExStatus> | null = null;
  let pickedUp = false;

  try {
    const dist = await getPostExTrackingDetail(s.trackingNumber);
    statusRaw = resolvePostExCurrentStatus(dist);
    journeyRaw = resolvePostExJourneyText(dist);
    pickedUp = hasPostExPickupInTracking(dist);
    mapped = mapPostExStatus(statusRaw);
    outcome.status = statusRaw;
    outcome.journey = journeyRaw;
  } catch (error) {
    outcome.error = true;
    outcome.errorMessage = error instanceof Error ? error.message : 'Unknown PostEx tracking error';
    return outcome;
  }

  const markShipped = !mapped?.terminal && (pickedUp || isPostExPostPickupStatus(statusRaw));

  const shipmentPatch: {
    shipmentStatus?: ShipmentStatus;
    trackingStatusText?: string;
    trackingJourney?: string | null;
    trackingSyncedAt?: Date;
    shippedAt?: Date | null;
    deliveredAt?: Date;
  } = {};

  if (statusRaw !== 'Unknown' && statusRaw !== s.trackingStatusText) {
    shipmentPatch.trackingStatusText = statusRaw;
  }
  if (journeyRaw !== s.trackingJourney) {
    shipmentPatch.trackingJourney = journeyRaw;
  }
  shipmentPatch.trackingSyncedAt = new Date();

  // Advance on clearer courier progress; also allow correcting a false IN_TRANSIT
  // when PostEx still reports Unbooked / Booked / At Merchant.
  if (mapped && statusRaw !== 'Unknown') {
    const rankUp = SHIPMENT_RANK[mapped.shipment] > SHIPMENT_RANK[s.shipmentStatus];
    const correctFalseTransit =
      isPostExPrePickupStatus(statusRaw) &&
      mapped.shipment === ShipmentStatus.LABEL_CREATED &&
      s.shipmentStatus === ShipmentStatus.IN_TRANSIT;
    if (rankUp || correctFalseTransit) {
      shipmentPatch.shipmentStatus = mapped.shipment;
    }
    if (correctFalseTransit && !markShipped && AWAITING_PICKUP.includes(s.order.orderStatus)) {
      shipmentPatch.shippedAt = null;
    }
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
      pickedUp ? 'PostEx: Picked By PostEx' : `PostEx: ${statusRaw}`,
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
      trackingStatusText: true,
      trackingJourney: true,
      shippedAt: true,
      orderId: true,
      order: { select: { orderNumber: true, orderStatus: true } },
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
    errorDetails: [],
  };

  for (const s of shipments) {
    if (!s.trackingNumber) continue;
    result.checked += 1;
    const row = await reconcilePostExShipment(s);
    if (row.error) {
      result.errors += 1;
      if (result.errorDetails.length < 10) {
        result.errorDetails.push({
          orderNumber: s.order.orderNumber,
          trackingNumber: s.trackingNumber,
          message: row.errorMessage ?? 'Unknown PostEx tracking error',
        });
      }
    }
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
  journey: string | null;
  orderStatus: OrderStatus;
  shipped: boolean;
}> {
  const shipment = await prisma.shipment.findFirst({
    where: { orderId, courierName: 'PostEx', trackingNumber: { not: null } },
    select: {
      id: true,
      trackingNumber: true,
      shipmentStatus: true,
      trackingStatusText: true,
      trackingJourney: true,
      shippedAt: true,
      orderId: true,
      order: { select: { orderNumber: true, orderStatus: true } },
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
    journey: row.journey,
    orderStatus: order.orderStatus,
    shipped: row.shipped,
  };
}
