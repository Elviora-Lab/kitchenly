import 'server-only';

import { type Prisma, type PurchaseOrderStatus } from '@prisma/client';

import { prisma } from '@/lib/db';

const poLineInclude = {
  items: {
    include: {
      variant: {
        select: {
          id: true,
          sku: true,
          size: true,
          shade: true,
          stockQuantity: true,
          product: { select: { name: true } },
        },
      },
    },
    orderBy: { variant: { sku: 'asc' } },
  },
} satisfies Prisma.PurchaseOrderInclude;

export const suppliersRepo = {
  listAll() {
    return prisma.supplier.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { purchaseOrders: true, variants: true } } },
    });
  },

  listActive() {
    return prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, leadTimeDays: true, paymentTerms: true },
    });
  },

  findById(id: string) {
    return prisma.supplier.findUnique({
      where: { id },
      include: {
        variants: {
          include: { variant: { select: { sku: true, product: { select: { name: true } } } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  },
};

export const purchaseOrdersRepo = {
  async list(opts: { status?: PurchaseOrderStatus; skip: number; take: number }) {
    const where: Prisma.PurchaseOrderWhereInput = opts.status ? { status: opts.status } : {};

    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
        include: {
          supplier: { select: { name: true } },
          items: { select: { quantityOrdered: true, quantityReceived: true, unitCost: true } },
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return { items, total };
  },

  findById(id: string) {
    return prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        ...poLineInclude,
        supplier: true,
        creator: { select: { firstName: true, lastName: true, email: true } },
        receipts: {
          orderBy: { receivedAt: 'desc' },
          include: {
            items: true,
            receiver: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
  },

  /** Open orders for a variant — what's already on the way, for the buyer. */
  incomingForVariant(variantId: string) {
    return prisma.purchaseOrderItem.findMany({
      where: {
        variantId,
        purchaseOrder: { status: { in: ['SUBMITTED', 'PARTIALLY_RECEIVED'] } },
      },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            poNumber: true,
            expectedAt: true,
            supplier: { select: { name: true } },
          },
        },
      },
    });
  },
};
