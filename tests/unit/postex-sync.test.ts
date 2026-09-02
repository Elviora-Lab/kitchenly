import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPostExTrackingDetail: vi.fn(),
  hasPostExPickupInTracking: vi.fn(),
  isPostExPostPickupStatus: vi.fn(),
  mapPostExStatus: vi.fn(),
  resolvePostExJourneyText: vi.fn(),
  resolvePostExCurrentStatus: vi.fn(),
  shipmentFindMany: vi.fn(),
  shipmentUpdate: vi.fn(),
  transitionOrder: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    shipment: {
      findMany: mocks.shipmentFindMany,
      update: mocks.shipmentUpdate,
    },
    order: {
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

vi.mock('@/server/services/order-transitions.service', () => ({
  transitionOrder: mocks.transitionOrder,
}));

vi.mock('@/server/shipping/postex', () => ({
  getPostExTrackingDetail: mocks.getPostExTrackingDetail,
  hasPostExPickupInTracking: mocks.hasPostExPickupInTracking,
  isPostExPostPickupStatus: mocks.isPostExPostPickupStatus,
  mapPostExStatus: mocks.mapPostExStatus,
  resolvePostExJourneyText: mocks.resolvePostExJourneyText,
  resolvePostExCurrentStatus: mocks.resolvePostExCurrentStatus,
}));

import { syncPostExShipments } from '@/server/services/postex-sync.service';

describe('PostEx shipment sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns PostEx error details for failed tracking lookups', async () => {
    mocks.shipmentFindMany.mockResolvedValue([
      {
        id: 'shipment-1',
        trackingNumber: '24711770000012',
        shipmentStatus: 'LABEL_CREATED',
        trackingStatusText: null,
        trackingJourney: null,
        shippedAt: null,
        orderId: 'order-1',
        order: {
          orderNumber: 'ELV-2026-YR2BH81S',
          orderStatus: 'PROCESSING',
        },
      },
    ]);
    mocks.getPostExTrackingDetail.mockRejectedValue(new Error('PostEx: TOKEN IS INVALID'));

    await expect(syncPostExShipments()).resolves.toEqual({
      checked: 1,
      updated: 0,
      shipped: 0,
      delivered: 0,
      returned: 0,
      errors: 1,
      errorDetails: [
        {
          orderNumber: 'ELV-2026-YR2BH81S',
          trackingNumber: '24711770000012',
          message: 'PostEx: TOKEN IS INVALID',
        },
      ],
    });
  });

  it('marks processing orders shipped for post-pickup courier statuses', async () => {
    mocks.shipmentFindMany.mockResolvedValue([
      {
        id: 'shipment-1',
        trackingNumber: '24711770000012',
        shipmentStatus: 'LABEL_CREATED',
        trackingStatusText: null,
        trackingJourney: null,
        shippedAt: null,
        orderId: 'order-1',
        order: {
          orderNumber: 'ELV-2026-YR2BH81S',
          orderStatus: 'PROCESSING',
        },
      },
    ]);
    mocks.getPostExTrackingDetail.mockResolvedValue({ transactionStatus: 'At PostEx Warehouse' });
    mocks.resolvePostExCurrentStatus.mockReturnValue('At PostEx Warehouse');
    mocks.resolvePostExJourneyText.mockReturnValue('En-Route to PHALIA warehouse');
    mocks.hasPostExPickupInTracking.mockReturnValue(false);
    mocks.isPostExPostPickupStatus.mockReturnValue(true);
    mocks.mapPostExStatus.mockReturnValue({ shipment: 'IN_TRANSIT', terminal: false });
    mocks.transitionOrder.mockResolvedValue({ changed: true });

    await expect(syncPostExShipments()).resolves.toMatchObject({
      checked: 1,
      updated: 1,
      shipped: 1,
      errors: 0,
      errorDetails: [],
    });
    expect(mocks.shipmentUpdate).toHaveBeenCalledWith({
      where: { id: 'shipment-1' },
      data: expect.objectContaining({
        shipmentStatus: 'IN_TRANSIT',
        trackingStatusText: 'At PostEx Warehouse',
        trackingJourney: 'En-Route to PHALIA warehouse',
        trackingSyncedAt: expect.any(Date),
        shippedAt: expect.any(Date),
      }),
    });
    expect(mocks.transitionOrder).toHaveBeenCalledWith(
      'order-1',
      'SHIPPED',
      'PostEx: At PostEx Warehouse',
    );
  });
});
