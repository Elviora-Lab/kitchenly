import { OrderStatus, ShipmentStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  mapPostExStatus,
  resolvePostExCurrentStatus,
  toPostExPhone,
} from '@/server/shipping/postex';

describe('PostEx phone normalization', () => {
  it('normalizes Pakistan mobile formats to local 03xxxxxxxxx form', () => {
    expect(toPostExPhone('+92 300 1234567')).toBe('03001234567');
    expect(toPostExPhone('0092-301-1234567')).toBe('03011234567');
    expect(toPostExPhone('3021234567')).toBe('03021234567');
  });

  it('leaves already-local numbers in local form', () => {
    expect(toPostExPhone('03031234567')).toBe('03031234567');
  });
});

describe('PostEx status mapping', () => {
  it('keeps pre-pickup statuses at label-created without marking shipped', () => {
    expect(mapPostExStatus("At Merchant's Warehouse")).toEqual({
      shipment: ShipmentStatus.LABEL_CREATED,
      terminal: false,
    });
    expect(mapPostExStatus('Booked')).toEqual({
      shipment: ShipmentStatus.LABEL_CREATED,
      terminal: false,
    });
    expect(mapPostExStatus('Unbooked')).toEqual({
      shipment: ShipmentStatus.LABEL_CREATED,
      terminal: false,
    });
  });

  it('maps rider pickup and in-transit statuses to shipped', () => {
    expect(mapPostExStatus('Picked By PostEx')).toEqual({
      shipment: ShipmentStatus.IN_TRANSIT,
      order: OrderStatus.SHIPPED,
      terminal: false,
    });
    expect(mapPostExStatus('At PostEx Warehouse')).toEqual({
      shipment: ShipmentStatus.IN_TRANSIT,
      order: OrderStatus.SHIPPED,
      terminal: false,
    });
    expect(mapPostExStatus('Package on Root')).toEqual({
      shipment: ShipmentStatus.IN_TRANSIT,
      order: OrderStatus.SHIPPED,
      terminal: false,
    });
    expect(mapPostExStatus('Out For Delivery')).toEqual({
      shipment: ShipmentStatus.OUT_FOR_DELIVERY,
      order: OrderStatus.SHIPPED,
      terminal: false,
    });
    expect(mapPostExStatus('Attempt Made: Customer not available')).toEqual({
      shipment: ShipmentStatus.IN_TRANSIT,
      order: OrderStatus.SHIPPED,
      terminal: false,
    });
    expect(mapPostExStatus('In-Transit')).toEqual({
      shipment: ShipmentStatus.IN_TRANSIT,
      order: OrderStatus.SHIPPED,
      terminal: false,
    });
  });

  it('prefers transactionStatus over history when resolving current step', () => {
    expect(
      resolvePostExCurrentStatus({
        transactionStatus: 'Picked By PostEx',
        transactionStatusHistory: [
          {
            transactionStatusMessage: "At Merchant's Warehouse",
            transactionStatusMessageCode: '0001',
          },
          { transactionStatusMessage: 'Picked By PostEx', transactionStatusMessageCode: '0015' },
        ],
      }),
    ).toBe('Picked By PostEx');
  });

  it('picks the highest status code from history when summary is absent', () => {
    expect(
      resolvePostExCurrentStatus({
        transactionStatusHistory: [
          {
            transactionStatusMessage: "At Merchant's Warehouse",
            transactionStatusMessageCode: '0001',
          },
          { transactionStatusMessage: 'At PostEx Warehouse', transactionStatusMessageCode: '0003' },
        ],
      }),
    ).toBe('At PostEx Warehouse');
  });

  it('maps delivered and returned statuses to terminal order states', () => {
    expect(mapPostExStatus('Delivered')).toEqual({
      shipment: ShipmentStatus.DELIVERED,
      order: OrderStatus.DELIVERED,
      terminal: true,
    });
    expect(mapPostExStatus('Out For Return')).toEqual({
      shipment: ShipmentStatus.RETURNED,
      order: OrderStatus.RETURNED,
      terminal: true,
    });
  });
});
