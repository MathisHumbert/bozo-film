import { stegaClean } from "@sanity/client/stega";

import type { SeoFields, SiteSettings } from "../sanity/types";
import { urlForImage } from "../sanity/url-for-image";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SITE_LOCALE,
  THEME_COLOR,
} from "./constants";

export type OgType = "website" | "article" | "profile";

export interface MetaInput {
  seo?: SeoFields;
  site: SiteSettings;
  canonical: string;
  ogType: OgType;
  theme?: "light" | "dark" | null;
}

export interface Meta {
  title: string;
  description?: string;
  canonical: string;
  robots: string;
  themeColor: string;
  ogType: OgType;
  ogLocale: string;
  siteName?: string;
  image?: { url: string; alt?: string; width: number; height: number };
  twitterCard: "summary" | "summary_large_image";
  twitterHandle?: string;
  sameAs: string[];
  firstName?: string;
  lastName?: string;
}

const DEFAULT_TITLE = "Astro Creative Boilerplate";

const INDEXABLE = [
  "index",
  "follow",
  "max-image-preview:large",
  "max-snippet:-1",
  "max-video-preview:-1",
].join(", ");

export function buildMeta(input: MetaInput): Meta {
  const { seo, site, canonical, ogType, theme } = input;

  const fallback = site?.fallbackSEO;
  const identity = site?.siteIdentity;

  const title = seo?.metaTitle || fallback?.metaTitle || DEFAULT_TITLE;
  const description =
    seo?.metaDescription || fallback?.metaDescription || undefined;

  const source = seo?.ogImage?.asset ? seo.ogImage : fallback?.ogImage;
  const image = source?.asset
    ? {
        url: urlForImage(source)
          .width(OG_IMAGE_WIDTH)
          .height(OG_IMAGE_HEIGHT)
          .fit("crop")
          .auto("format")
          .url(),
        alt: source.alt || title,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
      }
    : undefined;

  const sameAs = mergeProfiles(identity?.sameAs, site?.footer?.socials);
  const [firstName, ...rest] = (identity?.name ?? "").trim().split(/\s+/);

  return stegaClean({
    title,
    description,
    canonical,
    robots: seo?.noIndex ? "noindex, nofollow" : INDEXABLE,
    themeColor: theme === "dark" ? THEME_COLOR.dark : THEME_COLOR.light,
    ogType,
    ogLocale: SITE_LOCALE,
    siteName: identity?.name || undefined,
    image,
    twitterCard: image ? "summary_large_image" : "summary",
    twitterHandle: twitterHandle(sameAs),
    sameAs,
    firstName: ogType === "profile" && rest.length > 0 ? firstName : undefined,
    lastName:
      ogType === "profile" && rest.length > 0 ? rest.join(" ") : undefined,
  });
}

function mergeProfiles(
  sameAs?: string[] | null,
  socials?: { external?: boolean; href?: string | null }[] | null,
): string[] {
  const external = (socials ?? [])
    .filter((link) => link.external && link.href)
    .map((link) => link.href!);

  return [...new Set([...(sameAs ?? []), ...external])];
}

function twitterHandle(sameAs: string[]): string | undefined {
  for (const url of sameAs) {
    const match = url.match(
      /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)/i,
    );

    if (match?.[1]) return `@${match[1]}`;
  }

  return undefined;
}
