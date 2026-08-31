import { OrderStatus, ShipmentStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { mapPostExStatus, toPostExPhone } from '@/server/shipping/postex';

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
  it('maps active courier statuses to in-flight shipment states', () => {
    expect(mapPostExStatus('Out For Delivery')).toEqual({
      shipment: ShipmentStatus.OUT_FOR_DELIVERY,
      terminal: false,
    });
    expect(mapPostExStatus('Attempt Made: Customer not available')).toEqual({
      shipment: ShipmentStatus.IN_TRANSIT,
      terminal: false,
    });
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
