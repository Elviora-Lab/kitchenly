/**
 * Product-copy audit — `npm run seo:audit-copy`
 *
 * READ-ONLY. Writes nothing to the database, ever. Its job is to answer two
 * questions repeatably:
 *
 *  1. What supplier-import damage is still in the stored copy?
 *  2. What does the site actually SERVE after `normalizeProductCopy` runs?
 *
 * The gap between those two numbers is what the read-time normalizer is
 * covering. A defect that shows up in column 2 is a rule that needs writing;
 * a product in the "needs a human" list is one no rule can save, because the
 * information simply is not there — and inventing it is not an option.
 *
 * Run it after touching `src/lib/seo/product-copy.ts`, and after any import.
 */
import { PrismaClient } from '@prisma/client';

import { normalizeProductCopy } from '../src/lib/seo/product-copy';

const prisma = new PrismaClient();

/** Below this, a description is too thin to serve a shopper or a crawler. */
const THIN_DESCRIPTION = 120;

type Detector = {
  id: string;
  note: string;
  test: RegExp | ((text: string, name: string) => boolean);
};

const DETECTORS: Detector[] = [
  {
    id: 'dangling-attribution',
    note: 'importer deleted a brand token and left "by ." / "from ."',
    test: /\b(?:by|from)\s+[.,;:!?]/i,
  },
  {
    id: 'html-entities',
    note: 'raw &amp; etc. would double-encode',
    test: /&(?:amp|lt|gt|quot|#0?39|nbsp|rsquo|lsquo|ndash|mdash);/i,
  },
  {
    id: 'source-shop-price-spam',
    note: 'another shop’s "best prices of X in Pakistan" template',
    test: /best\s+price(?:s)?\s+(?:in|of)|lowest\s+price|latest\s+price|price\s+refusal/i,
  },
  {
    id: 'city-list',
    note: 'scraped "delivery in all major cities" filler',
    test: /\b(?:karachi|lahore|islamabad)\b[\s\S]{0,80}\b(?:karachi|lahore|islamabad|multan|rawalpindi)\b/i,
  },
  {
    id: 'wholesale-pitch',
    note: 'B2B pricing pitch on a D2C storefront',
    test: /wholesale\s+price/i,
  },
  {
    id: 'foreign-return-policy',
    note: "another shop's returns window — contradicts our published policy",
    test: /hassle[\s-]*free\s+\d+\s*days?\s+return/i,
  },
  {
    id: 'supplier-template',
    note: 'generic "Why Buy From Us" block, identical across products',
    test: /why\s+buy\s+(?:from\s+us|for\s+this)|customer\s+satisfaction\s+guarantee/i,
  },
  {
    id: 'take-a-look-lead-in',
    note: 'listing-page lead-in, not a description',
    test: /take\s+a\s+look/i,
  },
  {
    id: 'glued-heading',
    note: 'lost newline welded a heading onto the body',
    test: /[a-z](?:Kitchen Accessories|Home and Living|Home And Living)/,
  },
  {
    id: 'repeated-product-name',
    note: 'product name repeated 3+ times — keyword stuffing',
    test: (text, name) => {
      const key = name
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 4)
        .join(' ');
      return key.length >= 12 && text.toLowerCase().split(key).length - 1 >= 3;
    },
  },
];

const hits = (text: string, name: string) =>
  DETECTORS.filter((d) =>
    typeof d.test === 'function' ? d.test(text, name) : d.test.test(text),
  ).map((d) => d.id);

async function main() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      name: true,
      slug: true,
      shortDescription: true,
      fullDescription: true,
      isFeatured: true,
      category: { select: { name: true, slug: true } },
      _count: { select: { viewLogs: true, orderItems: true } },
    },
  });

  // Category size is the honest proxy for commercial value here: engagement
  // logs are still near-empty on a new store, so ranking by views would just
  // sort noise. A product in the 197-item kitchen category has far more
  // traffic potential than one in a 3-item category.
  const categorySize = new Map<string, number>();
  for (const p of products) {
    const key = p.category?.slug ?? 'uncategorized';
    categorySize.set(key, (categorySize.get(key) ?? 0) + 1);
  }

  const rows = products.map((p) => {
    const raw = [p.shortDescription, p.fullDescription].filter(Boolean).join(' \n ');
    const served = normalizeProductCopy(raw);
    return {
      ...p,
      raw,
      served,
      rawHits: hits(raw, p.name),
      servedHits: hits(served, p.name),
      engagement: p._count.viewLogs + p._count.orderItems * 5,
      catSize: categorySize.get(p.category?.slug ?? 'uncategorized') ?? 0,
    };
  });

  const tally = (key: 'rawHits' | 'servedHits') => {
    const m = new Map<string, number>();
    for (const r of rows) for (const h of r[key]) m.set(h, (m.get(h) ?? 0) + 1);
    return m;
  };
  const rawTally = tally('rawHits');
  const servedTally = tally('servedHits');

  console.log(`\nProduct copy audit — ${rows.length} active products\n`);
  console.log('  defect                        stored   served   what it is');
  console.log('  ' + '-'.repeat(94));
  for (const d of DETECTORS) {
    const before = rawTally.get(d.id) ?? 0;
    const after = servedTally.get(d.id) ?? 0;
    const flag = after > 0 ? '  <-- REACHES THE PAGE' : '';
    console.log(
      `  ${d.id.padEnd(28)} ${String(before).padStart(6)}   ${String(after).padStart(6)}   ${d.note}${flag}`,
    );
  }

  const needsHuman = rows
    .filter((r) => r.served.length < THIN_DESCRIPTION)
    .sort(
      (a, b) =>
        b.catSize - a.catSize || b.engagement - a.engagement || a.served.length - b.served.length,
    );

  console.log(`\n\nNEEDS A HUMAN — description under ${THIN_DESCRIPTION} chars after cleaning`);
  console.log('No rule can fix these: the information is not in the data. Write real copy,');
  console.log('or leave them thin — do NOT invent specifications to pad them.\n');
  console.log(`  ${needsHuman.length} products, highest-traffic categories first:\n`);
  for (const r of needsHuman.slice(0, 50)) {
    console.log(
      `  ${String(r.served.length).padStart(4)} chars | ${(r.category?.name ?? '—').padEnd(22)} | ${r.slug}`,
    );
  }
  if (needsHuman.length > 50) console.log(`  … and ${needsHuman.length - 50} more`);

  const stuffed = rows.filter((r) => r.servedHits.includes('repeated-product-name'));
  console.log(`\n\nKEYWORD-STUFFED — product name repeated 3+ times: ${stuffed.length} products`);
  console.log('Left as-is deliberately: de-duplicating a name inside a sentence needs judgement,');
  console.log('and a bad automatic edit reads worse than the repetition. Rewrite by hand.\n');
  for (const r of stuffed.slice(0, 20)) {
    console.log(`  ${(r.category?.name ?? '—').padEnd(22)} | ${r.slug}`);
  }
  if (stuffed.length > 20) console.log(`  … and ${stuffed.length - 20} more`);

  const clean = rows.filter(
    (r) => r.servedHits.length === 0 && r.served.length >= THIN_DESCRIPTION,
  );
  console.log(`\n\nSUMMARY`);
  console.log(`  serving clean, usable copy : ${clean.length}/${rows.length}`);
  console.log(`  needs human copywriting    : ${needsHuman.length}`);
  console.log(
    `  defects still reaching page: ${[...servedTally.values()].reduce((a, b) => a + b, 0)}`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
