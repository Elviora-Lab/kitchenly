import { CATEGORY_TREE, orderedChildren } from '@/config/taxonomy';

export type NavItem = {
  label: string;
  href: string;
  description?: string;
  children?: NavItem[];
  /** Render as a non-clickable "coming soon" item (no products yet). */
  comingSoon?: boolean;
};

export const mainNav: NavItem[] = [
  {
    label: 'Shop',
    // The mega menu is data-driven: children come from the shared taxonomy
    // (real `categories.slug` values, route `/categories/[slug]`), including
    // one level of subcategories — so it re-shapes itself as the catalog does.
    href: '/products',
    children: CATEGORY_TREE.map((cat) => ({
      label: cat.name,
      href: `/categories/${cat.slug}`,
      children: orderedChildren(cat).map((sub) => ({
        label: sub.name,
        href: `/categories/${sub.slug}`,
      })),
    })),
  },
  { label: 'Best Sellers', href: '/products?sort=popular' },
  { label: 'New Arrivals', href: '/products?sort=newest' },
  { label: 'Home Guides', href: '/blog' },
];

export const footerNav: Record<string, NavItem[]> = {
  Shop: [
    { label: 'New Arrivals', href: '/products?sort=newest' },
    { label: 'Best Sellers', href: '/products?sort=popular' },
    { label: 'Gift Cards', href: '/gift-cards' },
  ],
  Help: [
    { label: 'Contact', href: '/contact' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Shipping & Returns', href: '/shipping' },
  ],
  Company: [
    { label: 'Our Story', href: '/about' },
    { label: 'Our Promise', href: '/sustainability' },
    { label: 'Press', href: '/press' },
    { label: 'Careers', href: '/careers' },
  ],
  Legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'Accessibility', href: '/accessibility' },
  ],
};

export const accountNav: NavItem[] = [
  { label: 'Overview', href: '/account' },
  { label: 'Orders', href: '/account/orders' },
  { label: 'Wishlist', href: '/account/wishlist' },
  { label: 'Addresses', href: '/account/addresses' },
  { label: 'Notifications', href: '/account/notifications' },
];

export const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin' },
  { label: 'Products', href: '/admin/products' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'Brands', href: '/admin/brands' },
  { label: 'Orders', href: '/admin/orders' },
  { label: 'Returns', href: '/admin/returns' },
  { label: 'Reviews', href: '/admin/reviews' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Coupons', href: '/admin/coupons' },
  { label: 'Flash Sale', href: '/admin/flash-sale' },
  { label: 'Analytics', href: '/admin/analytics' },
  { label: 'Audience', href: '/admin/audience' },
  { label: 'Pixel Events', href: '/admin/pixel' },
  { label: 'Clicks', href: '/admin/clicks' },
  { label: 'Ad Performance', href: '/admin/ads' },
  { label: 'Banners', href: '/admin/banners' },
  { label: 'Blog', href: '/admin/blog' },
];
