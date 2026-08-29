/**
 * Per-category SEO content.
 *
 * Every field here is written by hand, per category, against the products that
 * are actually in stock. That is the point: `categories.description` is NULL for
 * every row in the database, so the category pages previously rendered no intro
 * copy at all and all eight shared ONE templated meta description — eight pages
 * competing on identical text, none of them saying what they sell.
 *
 * Rules this file exists to enforce:
 *  - No paragraph is reused between categories. Each targets its OWN keyword
 *    cluster and names the product types that category genuinely contains.
 *  - Nothing is invented. Product types listed in the copy were taken from the
 *    live catalog; delivery and returns claims come from `siteConfig.policy`.
 *  - Related links point sideways (sibling categories) and down (guides), which
 *    spreads crawl depth WITHOUT adding a level to the customer-facing nav.
 *
 * Keyed by `categories.slug`. A category with no entry still renders — it just
 * falls back to generated copy — so adding a category to the DB never 500s a
 * page. Add an entry here in the same change that adds real inventory.
 */

export type CategorySeo = {
  /** Visible page heading. Kept close to the nav label so the two agree. */
  h1: string;
  /** `<title>` without the brand suffix, which `generateCategoryMetadata` adds. */
  title: string;
  /** Meta description. Aim for 140–155 characters. */
  description: string;
  /** One-line hook for cards and tiles (homepage bento, /categories grid). */
  blurb: string;
  /** Intro paragraph shown under the H1 — for shoppers first, crawlers second. */
  lead: string;
  /** Bottom-of-page sections. Two or three; each answers a real buying question. */
  body: { heading: string; text: string }[];
  /** Keyword cluster this page owns. Documentation, not output — never rendered. */
  keywords: string[];
  /** Sibling category slugs to cross-link. */
  related: string[];
  /** Blog post slugs that support this cluster. */
  guides: string[];
};

/**
 * A category needs a real assortment before it deserves an indexable landing
 * page. Below this count the page stays live and linked (shoppers can still
 * browse it) but is served `noindex, follow` and kept out of the sitemap, so we
 * never ask Google to rank a three-product page. It re-enters the index by
 * itself once inventory grows — no code change needed.
 */
export const MIN_INDEXABLE_PRODUCTS = 8;

export const CATEGORY_SEO: Record<string, CategorySeo> = {
  'kitchen-accessories': {
    h1: 'Kitchen Accessories & Gadgets',
    title: 'Kitchen Accessories Online in Pakistan',
    description:
      'Shop kitchen accessories in Pakistan — hand choppers, airtight storage jars, utensil sets, jugs and cabinet organizers. Cash on delivery nationwide.',
    blurb: 'Tools that earn their drawer space',
    lead: 'The tools that decide whether cooking feels like a chore or a ten-minute job: hand-pull choppers, airtight rice and cereal dispensers, oil filter pots, utensil sets, and the storage that keeps a counter clear. Everything here is chosen for how it holds up after a month of daily use, not how it photographs.',
    body: [
      {
        heading: 'What you will find in this category',
        text: 'Three groups make up most of this shelf. Prep tools — manual food choppers, pastry and cookie cutters, carving and peeling sets — that cut the slow part of a recipe down to a pull of a cord. Storage — airtight containers, grain and rice dispensers, egg trays, reusable food pouches — that keeps a pantry legible and stops half a bag of rice going stale. And serving — plates with stands, jugs, tumblers, ice trays — for the days people actually come over.',
      },
      {
        heading: 'Choosing kitchen tools that last',
        text: 'For anything that touches heat or blades, weight is the honest signal: stainless steel that feels substantial in the hand outlives thin pressed metal. For storage, the seal matters more than the container — check that a lid clicks rather than rests. And buy for the drawer you actually have; a twelve-piece set that will not close a drawer gets used twice.',
      },
      {
        heading: 'Delivery and payment',
        text: 'Kitchen orders ship across Pakistan in 2–5 working days with cash on delivery available nationwide, so you pay once the box is in your hands. Delivery is free over Rs 3,300; below that the exact courier charge for your city is shown at checkout before you confirm.',
      },
    ],
    keywords: [
      'kitchen accessories Pakistan',
      'kitchen gadgets Pakistan',
      'kitchen tools online Pakistan',
      'kitchen organizers Pakistan',
      'vegetable chopper Pakistan',
      'airtight food containers Pakistan',
    ],
    related: ['home-living', 'wardrobe-organizers', 'random-gadgets'],
    guides: ['kitchen-cabinet-organizing-guide', 'faucet-aerator-guide'],
  },

  'home-living': {
    h1: 'Home & Living Essentials',
    title: 'Home Essentials & Cleaning Products Online in Pakistan',
    description:
      'Home and living essentials in Pakistan — under-sink racks, cleaning brushes, wall shelves, storage carts and everyday utility items. COD available.',
    blurb: 'Everyday pieces for a calmer home',
    lead: 'The quiet infrastructure of a house: the rack that finally uses the space under the sink, the long-handled brush that reaches behind the washing machine, the corner shelf that turns dead wall into storage. Unglamorous, used daily, and the first things you miss when they are not there.',
    body: [
      {
        heading: 'Built around the rooms that get the most traffic',
        text: 'Cleaning and utility sits at the centre — silicone gloves, flexible long-handle brushes, garbage bags, screen repair tape, portable washing machines for a small flat. Around it sits the storage that keeps a room from silently filling up: two-tier sliding cabinet baskets, rolling trolleys, wall-mounted corner shelves, and desktop boxes for the drawer everything ends up in.',
      },
      {
        heading: 'Small fixes with an outsized effect',
        text: 'Most of the frustration in a home is a five-minute problem nobody has got around to. A sliding under-sink basket doubles a cupboard that was already full. A rolling cart moves the whole clutter problem out of the kitchen when guests arrive. Self-adhesive hooks and mounts do the work of a drill without a landlord conversation.',
      },
      {
        heading: 'Ordering and delivery',
        text: 'Everything in Home & Living ships nationwide in 2–5 working days, cash on delivery, with free shipping once your order passes Rs 3,300. Returns are open for 3 days after delivery if something is not what you expected.',
      },
    ],
    keywords: [
      'home essentials Pakistan',
      'household products online Pakistan',
      'cleaning products Pakistan',
      'home storage racks Pakistan',
      'under sink organizer Pakistan',
    ],
    related: ['kitchen-accessories', 'home-wall-decor', 'wardrobe-organizers'],
    guides: ['faucet-aerator-guide', 'vertical-wall-storage-guide'],
  },

  'wardrobe-organizers': {
    h1: 'Wardrobe & Storage Organizers',
    title: 'Wardrobe Organizers & Storage Boxes Online in Pakistan',
    description:
      'Wardrobe organizers in Pakistan — magic multi-hole hangers, jewellery boxes, sock and drawer dividers, over-door pockets and shoe storage bags.',
    blurb: 'Keep clothes and clutter in their place',
    lead: 'Space-multiplying storage for a cupboard that stopped closing a while ago. Nine-hole folding hangers that stack five shirts in the width of one, over-door pocket organizers, drawer dividers for socks and accessories, and clear boxes that let you see what you own without unpacking it.',
    body: [
      {
        heading: 'Vertical space is the space you are not using',
        text: 'Most wardrobes are not short of room — they are short of levels. Multi-hole magic hangers turn one rail slot into five. Over-door organizers claim a surface nobody counts. Stackable transparent boxes turn a deep, dark shelf into something you can actually shop from. The rail stays the same width; the wardrobe holds far more.',
      },
      {
        heading: 'Keeping small things findable',
        text: 'Jewellery, watches, and accessories disappear in general storage. Compartment trays, multi-layer acrylic and velvet organizer boxes, and grid dividers give each item a fixed home, which is what actually stops the ten-minute search before you leave the house. Travel shoe bags and zip pouches do the same job inside a suitcase.',
      },
      {
        heading: 'Delivery across Pakistan',
        text: 'Organizers are light, so they ship quickly — 2–5 working days nationwide, cash on delivery, free over Rs 3,300. If a size does not suit your wardrobe, returns are open for 3 days after delivery.',
      },
    ],
    keywords: [
      'wardrobe organizer Pakistan',
      'storage boxes online Pakistan',
      'magic hangers Pakistan',
      'jewellery organizer box Pakistan',
      'closet organizer price in Pakistan',
    ],
    related: ['home-living', 'kitchen-accessories', 'home-wall-decor'],
    guides: ['small-closet-multi-hole-hangers', 'vertical-wall-storage-guide'],
  },

  'health-beauty': {
    h1: 'Health & Beauty Essentials',
    title: 'Beauty Tools & Personal Care Products Online in Pakistan',
    description:
      'Beauty and personal care in Pakistan — makeup organizers, facial and grooming tools, hair stylers, eyebrow razors and travel-size refill bottles.',
    blurb: 'Grooming and self-care essentials',
    lead: 'Grooming and self-care tools, plus the organizers that keep them in order. Hair stylers and trimmers, facial rollers and pore tools, eyebrow and facial razor kits, refillable travel bottles, and rotating acrylic organizers that put a whole routine within arm’s reach.',
    body: [
      {
        heading: 'Tools, not formulas',
        text: 'This category is deliberately hardware: the brush storage box, the 12-grid lipstick holder, the three-drawer cosmetic organizer, the ice roller, the electric nail trimmer. Tools outlast the products they serve, so they are worth choosing carefully once rather than replacing every season.',
      },
      {
        heading: 'Built for small bathrooms and travel',
        text: 'Counter space is usually the real constraint. Rotating organizers use one footprint for the whole collection, drawer inserts move the overflow out of sight, and refillable atomizers and lotion pouches take a routine into a carry-on without decanting into whatever bottle is spare.',
      },
      {
        heading: 'Ordering, delivery and returns',
        text: 'Nationwide delivery in 2–5 working days with cash on delivery. Free shipping over Rs 3,300, and 3 days from delivery to return anything unopened that is not right for you.',
      },
    ],
    keywords: [
      'beauty tools Pakistan',
      'makeup organizer Pakistan',
      'personal care products online Pakistan',
      'hair styler price in Pakistan',
      'grooming kit Pakistan',
    ],
    related: ['wardrobe-organizers', 'random-gadgets', 'home-living'],
    guides: ['small-closet-multi-hole-hangers'],
  },

  'random-gadgets': {
    h1: 'Useful Gadgets & Multi-Tools',
    title: 'Smart Gadgets & Household Tools Online in Pakistan',
    description:
      'Practical gadgets in Pakistan — cordless vacuums, EDC multi-tools, screwdriver sets, insulated bottles, cleaning brushes and clever one-job tools.',
    blurb: 'Clever one-job tools worth the space',
    lead: 'One-job tools that do their job properly, and multi-tools that replace four of them. Portable cordless vacuums, magnetic screwdriver sets, stainless EDC tools, gap-cleaning brushes, insulated bottles, phone ring grips — the drawer of things you did not know you needed until the first time you used one.',
    body: [
      {
        heading: 'The case for a single-purpose tool',
        text: 'A hard-bristled gap brush exists because no general-purpose brush reaches a window track. A fruit carving scoop exists because a knife does it badly. Specific tools are cheap, small, and remove a recurring annoyance permanently — which is a better return than most things at the same price.',
      },
      {
        heading: 'Where multi-tools earn their place',
        text: 'The opposite also holds. An 11-in-1 stainless EDC tool or a 31-piece magnetic screwdriver set replaces a shelf of half-used items and travels in a glovebox or a drawer. Look for the number of functions you will genuinely use — a tool with four useful heads beats one with twenty novelty ones.',
      },
      {
        heading: 'Delivery and payment',
        text: 'Gadgets ship across Pakistan in 2–5 working days, cash on delivery available, free over Rs 3,300. Anything electrical arrives ready to charge, and returns stay open for 3 days after delivery.',
      },
    ],
    keywords: [
      'gadgets online Pakistan',
      'household gadgets Pakistan',
      'multi tool price in Pakistan',
      'portable vacuum cleaner Pakistan',
      'screwdriver set Pakistan',
    ],
    related: ['kitchen-accessories', 'mobile-accessories', 'home-living'],
    guides: ['cable-management-home-guide'],
  },

  'home-wall-decor': {
    h1: 'Home & Wall Decor',
    title: 'Wall Decor, Stickers & Home Lighting Online in Pakistan',
    description:
      'Wall decor in Pakistan — peel-and-stick mosaic tiles, hexagon mirrors, wall hooks, LED night lights and self-adhesive decals that need no drilling.',
    blurb: 'Finishing touches for every room',
    lead: 'Finishing touches that go up in an afternoon and come down without a mark. Peel-and-stick mosaic tiles and tile decals, hexagon mirror sets, wooden flower stickers, USB and sensor night lights, and the wall hooks and no-drill holders that make a wall useful as well as good-looking.',
    body: [
      {
        heading: 'Decor that suits a rented flat',
        text: 'Almost everything here is self-adhesive. Tile stickers cover a tired kitchen splashback without touching the tiles underneath. Hexagon mirrors and decals rearrange as often as you like. No-drill shower and shelf holders mount on adhesive rather than a wall plug. Nothing needs a landlord’s permission or a drill.',
      },
      {
        heading: 'Light changes a room faster than paint',
        text: 'Sensor LED mushroom lights make a hallway navigable at 2am. Mini USB bulbs turn a shelf into a display. Warm, low-level light in the corners of a room reads as calm in a way an overhead tube light never does — and it is the cheapest change on this page.',
      },
      {
        heading: 'Ordering and delivery',
        text: 'Decor ships nationwide in 2–5 working days with cash on delivery, free over Rs 3,300. Adhesive items are packed flat to arrive uncreased; if something arrives damaged, tell us within 3 days of delivery.',
      },
    ],
    keywords: [
      'wall decor Pakistan',
      'wall stickers online Pakistan',
      'home decor items Pakistan',
      'tile stickers Pakistan',
      'led night light Pakistan',
    ],
    related: ['home-living', 'wardrobe-organizers', 'kitchen-accessories'],
    guides: ['vertical-wall-storage-guide'],
  },

  'babies-toys': {
    h1: 'Baby Essentials & Kids’ Toys',
    title: 'Baby Products & Kids Toys Online in Pakistan',
    description:
      'Baby and kids products in Pakistan — silicone feeding sets, LCD writing tablets, corner protectors, diaper bags, paddling pools and craft kits.',
    blurb: 'Safe, practical picks for little ones',
    lead: 'Practical baby gear and toys that survive being played with. BPA-free silicone feeding sets, sleeping support pillows, waterproof diaper bags and safety harnesses on one side; LCD writing tablets, foam clay sets, plush toys and inflatable paddling pools on the other.',
    body: [
      {
        heading: 'Feeding, safety and the daily routine',
        text: 'The baby half of this category is the equipment that gets used several times a day: silicone feeding essentials, electric nail trimmers with replacement heads, table corner protectors, adjustable sleeping positioners, and an all-in-one diaper bag that holds a day out. Chosen for material quality and easy cleaning, because both are tested nightly.',
      },
      {
        heading: 'Toys that keep working after the first week',
        text: 'LCD writing tablets replace an endless stack of paper and hold attention far longer than they should. Craft and foam clay sets create something at the end. Paddling pools and water balloon packs handle a Karachi summer. We stay away from single-use novelties that break before the excitement does.',
      },
      {
        heading: 'Delivery, payment and returns',
        text: 'Nationwide delivery in 2–5 working days with cash on delivery, free over Rs 3,300. Returns are open 3 days from delivery — please check feeding and safety items on arrival and tell us straight away if anything is not right.',
      },
    ],
    keywords: [
      'baby products online Pakistan',
      'kids toys Pakistan',
      'baby feeding set Pakistan',
      'lcd writing tablet for kids Pakistan',
      'baby safety products Pakistan',
    ],
    related: ['home-living', 'health-beauty', 'random-gadgets'],
    guides: ['vertical-wall-storage-guide'],
  },

  'mobile-accessories': {
    h1: 'Mobile Accessories',
    title: 'Mobile Accessories & Phone Holders Online in Pakistan',
    description:
      'Mobile accessories in Pakistan — universal dashboard phone mounts, waterproof pouches and zip cases for cables, chargers and earphones.',
    blurb: 'Small add-ons for phones and devices',
    lead: 'Phone and cable accessories that travel well: universal suction dashboard mounts, waterproof pouches for the pool and the monsoon, and hard zip cases that keep a charger, cable and earphones together instead of loose in a bag.',
    body: [
      {
        heading: 'A small, growing shelf',
        text: 'This is our newest category and it is deliberately short — a handful of accessories that earned their place rather than a wall of phone cases. It grows as we find items that hold up: mounts that stay stuck in summer heat, pouches that actually seal, cases that survive a bag.',
      },
      {
        heading: 'Cable clutter, solved elsewhere too',
        text: 'If your problem is cables rather than the phone itself, the clips, silicone guards and wall-mounted holders in Home & Living and Random Gadgets cover more ground — our cable management guide walks through both.',
      },
    ],
    keywords: [
      'mobile accessories Pakistan',
      'phone holder price in Pakistan',
      'car mobile mount Pakistan',
      'waterproof phone pouch Pakistan',
    ],
    related: ['random-gadgets', 'home-living', 'wardrobe-organizers'],
    guides: ['cable-management-home-guide'],
  },
};

export function categorySeo(slug: string): CategorySeo | undefined {
  return CATEGORY_SEO[slug];
}

/**
 * The `guides` mapping, inverted: which categories a blog post supports.
 *
 * Derived rather than declared separately so the two directions of the
 * category ↔ guide link can never disagree — a guide added to a category here
 * immediately gains a "shop this guide" link back to that category, which is
 * what turns an informational post into a route to a commercial page.
 */
export function categorySlugsForGuide(guideSlug: string): string[] {
  return Object.entries(CATEGORY_SEO)
    .filter(([, seo]) => seo.guides.includes(guideSlug))
    .map(([slug]) => slug);
}
