import { CATEGORY_TREE } from '@/config/taxonomy';

export type NavItem = {
  label: string;
  /** Optional compact label for the tight desktop nav row (full `label` is
   *  used everywhere else — mobile drawer, analytics). */
  shortLabel?: string;
  href: string;
  description?: string;
  children?: NavItem[];
  /** Render as a non-clickable "coming soon" item (no products yet). */
  comingSoon?: boolean;
};

// Compact labels for the desktop category bar, keyed by taxonomy slug. Keeping
// them here (not in the taxonomy) means the full category name stays canonical
// for pages, breadcrumbs, and analytics — only the tight nav row abbreviates.
const CATEGORY_SHORT_LABELS: Record<string, string> = {
  'kitchen-accessories': 'Kitchen',
  'home-living': 'Living',
  'health-beauty': 'Beauty',
  'random-gadgets': 'Gadgets',
  'wardrobe-organizers': 'Wardrobe',
  'home-wall-decor': 'Decor',
  'babies-toys': 'Babies',
  'mobile-accessories': 'Mobile',
};

// Every top-level category, surfaced as a direct one-click link (route
// `/categories/[slug]`). Data-driven from the shared taxonomy, so it reshapes
// itself as the catalog changes. No dropdown — categories are visible inline.
export const categoryNav: NavItem[] = CATEGORY_TREE.map((cat) => ({
  label: cat.name,
  shortLabel: CATEGORY_SHORT_LABELS[cat.slug] ?? cat.name,
  href: `/categories/${cat.slug}`,
}));

// Promotional shortcuts — sort views over the whole catalog. Shown as compact
// links on the right of the desktop bar; folded into the mobile drawer.
export const quickLinks: NavItem[] = [
  { label: 'Best Sellers', href: '/products?sort=popular' },
  { label: 'New Arrivals', href: '/products?sort=newest' },
];

// Desktop primary row (left side): every category, then Home Guides.
export const primaryNav: NavItem[] = [...categoryNav, { label: 'Home Guides', href: '/blog' }];

// Full flat list for the mobile drawer — one tap per destination.
export const mainNav: NavItem[] = [...primaryNav, ...quickLinks];

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
