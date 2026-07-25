import 'server-only';

import { type OrderStatus, type Prisma, type UserRole } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * Admin-side repositories. These intentionally ignore `is_active` /
 * `is_approved` filters so operators see the full state of the catalog.
 */

// ---------- Dashboard ----------

// Orders that count toward recognized revenue. An order is excluded when it is
// voided/returned/refunded by EITHER signal:
//   - orderStatus CANCELLED / RETURNED / REFUNDED, or
//   - paymentStatus REFUNDED / VOIDED (a refund recorded on the payment even if
//     the order status wasn't flipped).
// We deliberately do NOT require paymentStatus = PAID: COD / bank-transfer
// orders are fulfilled without ever flipping to PAID (only the Stripe webhook
// sets PAID), so a positive paymentStatus filter would undercount real sales.
// PARTIALLY_REFUNDED stays counted — without a stored refund amount we can't
// subtract the partial value, and dropping the whole order would over-deduct.
const REVENUE_WHERE: Prisma.OrderWhereInput = {
  orderStatus: { notIn: ['CANCELLED', 'RETURNED', 'REFUNDED'] },
  paymentStatus: { notIn: ['REFUNDED', 'VOIDED'] },
};

const sumRevenue = async (extra?: Prisma.OrderWhereInput) => {
  const agg = await prisma.order.aggregate({
    _sum: { totalAmount: true },
    where: { ...REVENUE_WHERE, ...extra },
  });
  return Number(agg._sum.totalAmount ?? 0);
};

export const adminDashboardRepo = {
  async kpis() {
    const [
      revenue,
      revenueToday,
      revenueWeek,
      ordersLast30,
      productsCount,
      usersCount,
      pendingReviews,
      lowStockVariants,
    ] = await Promise.all([
      sumRevenue(),
      sumRevenue({ createdAt: { gte: startOfToday() } }),
      sumRevenue({ createdAt: { gte: startOfWeek() } }),
      prisma.order.count({
        where: { createdAt: { gte: daysAgo(30) } },
      }),
      prisma.product.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.review.count({ where: { isApproved: false } }),
      prisma.productVariant.count({ where: { isActive: true, stockQuantity: { lt: 10 } } }),
    ]);

    return {
      revenue,
      revenueToday,
      revenueWeek,
      ordersLast30,
      productsCount,
      usersCount,
      pendingReviews,
      lowStockVariants,
    };
  },

  recentOrders(limit = 5) {
    return prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { email: true, firstName: true } } },
    });
  },
};

function daysAgo(d: number) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

// Local-time calendar boundaries (uses the server's timezone).
function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function startOfWeek() {
  const t = startOfToday();
  const mondayOffset = (t.getDay() + 6) % 7; // Mon=0 … Sun=6
  t.setDate(t.getDate() - mondayOffset);
  return t;
}

// ---------- Products ----------

export const adminProductsRepo = {
  list(
    opts: {
      skip?: number;
      take?: number;
      q?: string;
      categoryId?: string;
      status?: 'active' | 'hidden';
    } = {},
  ) {
    const where: Prisma.ProductWhereInput = {
      ...(opts.q
        ? {
            OR: [
              { name: { contains: opts.q, mode: 'insensitive' } },
              { sku: { contains: opts.q, mode: 'insensitive' } },
              // slug carries the shade token (e.g. "…-cs-40"), so this lets
              // operators search a specific shade.
              { slug: { contains: opts.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(opts.status ? { isActive: opts.status === 'active' } : {}),
    };
    return prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip ?? 0,
        take: opts.take ?? 50,
        // select, not include: the table renders six columns — pulling every
        // product column (notably the Text description) here is pure payload.
        select: {
          id: true,
          name: true,
          slug: true,
          sku: true,
          price: true,
          isActive: true,
          category: { select: { name: true } },
          images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
          variants: { select: { stockQuantity: true, shade: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { sku: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
  },

  create(data: Prisma.ProductCreateInput) {
    return prisma.product.create({ data });
  },

  update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },

  updateVariantStock(variantId: string, stockQuantity: number) {
    return prisma.productVariant.update({
      where: { id: variantId },
      data: { stockQuantity },
      // Include the parent slug so callers can invalidate the product cache.
      include: { product: { select: { slug: true } } },
    });
  },

  async bulkSetActive(ids: string[], isActive: boolean) {
    const { count } = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isActive },
    });
    return count;
  },

  /** Slugs for a set of product ids — used to invalidate their PDP caches. */
  slugsForIds(ids: string[]) {
    return prisma.product.findMany({ where: { id: { in: ids } }, select: { slug: true } });
  },
};

// ---------- Orders ----------

export const adminOrdersRepo = {
  list(opts: { status?: OrderStatus; skip?: number; take?: number } = {}) {
    const where: Prisma.OrderWhereInput = opts.status ? { orderStatus: opts.status } : {};
    return prisma.$transaction([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip ?? 0,
        take: opts.take ?? 50,
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);
  },

  findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            role: true,
          },
        },
        items: true,
        payments: true,
        shipments: true,
        statusHistory: { orderBy: { createdAt: 'desc' } },
      },
    });
  },
};

// ---------- Reviews ----------

export const adminReviewsRepo = {
  listPending(opts: { skip?: number; take?: number } = {}) {
    return prisma.$transaction([
      prisma.review.findMany({
        where: { isApproved: false },
        orderBy: { createdAt: 'desc' },
        skip: opts.skip ?? 0,
        take: opts.take ?? 50,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          product: { select: { name: true, slug: true } },
          images: true,
        },
      }),
      prisma.review.count({ where: { isApproved: false } }),
    ]);
  },

  approve(id: string) {
    return prisma.review.update({ where: { id }, data: { isApproved: true } });
  },

  delete(id: string) {
    return prisma.review.delete({ where: { id } });
  },
};

// ---------- Categories ----------

export const adminCategoriesRepo = {
  listAll() {
    return prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { name: true } },
        // Count MEMBERSHIPS, not just products holding this as their primary
        // category. The admin page blocks deletion on this count, and deleting
        // a category cascades its membership rows away — so counting primaries
        // only would let an operator silently unmerchandise products that are
        // in this category as a secondary.
        _count: { select: { productMappings: true } },
      },
    });
  },

  create(data: Prisma.CategoryCreateInput) {
    return prisma.category.create({ data });
  },

  update(id: string, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.category.delete({ where: { id } });
  },
};

// ---------- Brands ----------

export const adminBrandsRepo = {
  listAll() {
    return prisma.brand.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  },

  create(data: Prisma.BrandCreateInput) {
    return prisma.brand.create({ data });
  },

  update(id: string, data: Prisma.BrandUpdateInput) {
    return prisma.brand.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.brand.delete({ where: { id } });
  },
};

// ---------- Analytics ----------

type ProductLite = { id: string; name: string; slug: string; imageUrl: string };
type RankedProduct = ProductLite & { count: number };

/** Resolve product display info for a set of ids, keyed by id. */
async function resolveProducts(ids: string[]): Promise<Map<string, ProductLite>> {
  if (ids.length === 0) return new Map();
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      slug: true,
      images: { where: { isPrimary: true }, take: 1, select: { imageUrl: true } },
    },
  });
  return new Map(
    products.map((p) => [
      p.id,
      { id: p.id, name: p.name, slug: p.slug, imageUrl: p.images[0]?.imageUrl ?? '' },
    ]),
  );
}

const since = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

export const adminAnalyticsRepo = {
  /** Top viewed products in the window, with display info. */
  async topViewed(days: number, limit = 8): Promise<RankedProduct[]> {
    const rows = await prisma.productViewLog.groupBy({
      by: ['productId'],
      where: { viewedAt: { gte: since(days) } },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    });
    const map = await resolveProducts(rows.map((r) => r.productId));
    return rows.flatMap((r) => {
      const p = map.get(r.productId);
      return p ? [{ ...p, count: r._count.productId }] : [];
    });
  },

  /** Top products added to cart in the window, with display info. */
  async topAddedToCart(days: number, limit = 8): Promise<RankedProduct[]> {
    const rows = await prisma.cartEventLog.groupBy({
      by: ['productId'],
      where: { createdAt: { gte: since(days) } },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    });
    const map = await resolveProducts(rows.map((r) => r.productId));
    return rows.flatMap((r) => {
      const p = map.get(r.productId);
      return p ? [{ ...p, count: r._count.productId }] : [];
    });
  },

  /** Top search keywords in the window. */
  async topSearches(days: number, limit = 8): Promise<Array<{ keyword: string; count: number }>> {
    const rows = await prisma.searchLog.groupBy({
      by: ['keyword'],
      where: { searchedAt: { gte: since(days) } },
      _count: { keyword: true },
      orderBy: { _count: { keyword: 'desc' } },
      take: limit,
    });
    return rows.map((r) => ({ keyword: r.keyword, count: r._count.keyword }));
  },

  /** Searches that returned NOTHING — demand you don't stock or can't be found. */
  async zeroResultSearches(
    days: number,
    limit = 10,
  ): Promise<Array<{ keyword: string; count: number }>> {
    const rows = await prisma.searchLog.groupBy({
      by: ['keyword'],
      where: { searchedAt: { gte: since(days) }, resultCount: 0 },
      _count: { keyword: true },
      orderBy: { _count: { keyword: 'desc' } },
      take: limit,
    });
    return rows.map((r) => ({ keyword: r.keyword, count: r._count.keyword }));
  },

  /** On-site survey answers grouped by question → answer, most-common first. */
  async surveyBreakdown(
    days: number,
  ): Promise<Array<{ question: string; answer: string; count: number }>> {
    const rows = await prisma.surveyResponse.groupBy({
      by: ['question', 'answer'],
      where: { createdAt: { gte: since(days) } },
      _count: { answer: true },
      orderBy: { _count: { answer: 'desc' } },
    });
    return rows.map((r) => ({ question: r.question, answer: r.answer, count: r._count.answer }));
  },

  /** View → cart → order volumes for the window (the funnel). */
  async funnel(days: number) {
    const gte = since(days);
    const [views, cartAdds, orders] = await Promise.all([
      prisma.productViewLog.count({ where: { viewedAt: { gte } } }),
      prisma.cartEventLog.count({ where: { createdAt: { gte } } }),
      prisma.order.count({ where: { createdAt: { gte } } }),
    ]);
    return { views, cartAdds, orders };
  },

  /**
   * Recognized store sales (real orders) in an explicit date range — used to
   * reconcile against Meta's *attributed* numbers on the ads dashboard. Uses the
   * same REVENUE_WHERE exclusions as the rest of the admin dashboard so the
   * figure matches what operators see elsewhere.
   */
  async salesForRange(sinceDate: Date, untilDate: Date) {
    const where: Prisma.OrderWhereInput = {
      ...REVENUE_WHERE,
      createdAt: { gte: sinceDate, lte: untilDate },
    };
    const [agg, orders, latest] = await Promise.all([
      prisma.order.aggregate({ _sum: { totalAmount: true }, where }),
      prisma.order.count({ where }),
      prisma.order.findFirst({
        where,
        select: { currency: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      revenue: Number(agg._sum.totalAmount ?? 0),
      orders,
      currency: latest?.currency ?? 'PKR',
    };
  },
};

// ---------- Users ----------

export const adminUsersRepo = {
  list(opts: { skip?: number; take?: number; q?: string } = {}) {
    const where: Prisma.UserWhereInput = opts.q
      ? {
          OR: [
            { email: { contains: opts.q, mode: 'insensitive' } },
            { firstName: { contains: opts.q, mode: 'insensitive' } },
            { lastName: { contains: opts.q, mode: 'insensitive' } },
          ],
        }
      : {};
    return prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: opts.skip ?? 0,
        take: opts.take ?? 50,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isVerified: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
  },

  updateRole(id: string, role: UserRole) {
    return prisma.user.update({ where: { id }, data: { role } });
  },
};

// ---------- Banners ----------

export const adminBannersRepo = {
  list() {
    return prisma.banner.findMany({ orderBy: [{ position: 'asc' }, { title: 'asc' }] });
  },
  create(data: Prisma.BannerCreateInput) {
    return prisma.banner.create({ data });
  },
  delete(id: string) {
    return prisma.banner.delete({ where: { id } });
  },
  setActive(id: string, isActive: boolean) {
    return prisma.banner.update({ where: { id }, data: { isActive } });
  },
};

// ---------- Blog ----------

export const adminBlogRepo = {
  list() {
    return prisma.blogPost.findMany({
      orderBy: [{ isPublished: 'desc' }, { publishedAt: 'desc' }],
      include: { category: { select: { name: true } } },
    });
  },
  create(data: Prisma.BlogPostCreateInput) {
    return prisma.blogPost.create({ data });
  },
  delete(id: string) {
    return prisma.blogPost.delete({ where: { id } });
  },
  setPublished(id: string, isPublished: boolean) {
    return prisma.blogPost.update({
      where: { id },
      data: { isPublished, publishedAt: isPublished ? new Date() : null },
    });
  },
};
