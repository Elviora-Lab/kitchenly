import type { Metadata } from 'next';

import { siteConfig } from '@/config/site';

type BuildMetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
  keywords?: string[];
};

export function buildMetadata({
  title,
  description = siteConfig.description,
  path = '/',
  image,
  noIndex,
  keywords,
}: BuildMetadataInput = {}): Metadata {
  const fullTitle = title
    ? `${title} — ${siteConfig.name}`
    : `${siteConfig.name} — ${siteConfig.tagline}`;
  const canonical = new URL(path, siteConfig.url).toString();
  // Only set an explicit image (e.g. a product photo). When none is given we
  // omit `images` so Next's file-based `opengraph-image` (the branded card)
  // supplies it — pointing at a hardcoded path that doesn't exist just yields
  // broken share previews.
  const explicitImages = image
    ? [{ url: image, width: 1200, height: 630, alt: fullTitle }]
    : undefined;

  return {
    metadataBase: new URL(siteConfig.url),
    title: fullTitle,
    description,
    keywords: keywords ?? [...siteConfig.keywords],
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName: siteConfig.name,
      title: fullTitle,
      description,
      url: canonical,
      // OG spec wants an underscore locale (en_PK), not the BCP-47 hyphen form.
      locale: siteConfig.locale.replace('-', '_'),
      ...(explicitImages ? { images: explicitImages } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
        },
    // Icons are provided by the app/ file convention (icon.svg, icon.png,
    // apple-icon.png), which Next injects into every page automatically.
  };
}

export const defaultMetadata: Metadata = {
  ...buildMetadata(),
  verification: {
    google: 'ODwySYaXf8h76ufWE4IN7ii1JYDDJ-Y_UJgda8r2Bhs',
  },
};
