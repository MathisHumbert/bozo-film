import { stegaClean } from "@sanity/client/stega";
import type {
  Graph,
  ImageObject,
  Organization,
  Person,
  Thing,
} from "schema-dts";

import type { SiteSettings } from "../sanity/types";
import { SITE_LANG } from "./constants";
import type { Meta } from "./meta";
import type { SeoPage } from "./types";

const KNOWS_ABOUT_SECTIONS = ["expertise", "services", "skills"];
const AWARD_SECTIONS = ["awards", "award", "recognition"];

export interface GraphInput {
  site: SiteSettings;
  meta: Meta;
  page?: SeoPage;
  origin: string;
  updatedAt?: string | null;
}

export function buildGraph(input: GraphInput): Graph {
  const { site, meta, page, origin, updatedAt } = input;

  const identityId = `${origin}/#identity`;
  const websiteId = `${origin}/#website`;
  const pageId = `${meta.canonical}#webpage`;

  const nodes: Thing[] = [];

  const identity = buildIdentity(site, meta, identityId, origin);

  if (identity) {
    nodes.push(identity);
  }

  nodes.push({
    "@type": "WebSite",
    "@id": websiteId,
    url: `${origin}/`,
    name: meta.siteName ?? meta.title,
    inLanguage: SITE_LANG,
    ...(identity ? { publisher: { "@id": identityId } } : {}),
  } as Thing);

  nodes.push({
    "@type": webPageType(page, site),
    "@id": pageId,
    url: meta.canonical,
    name: meta.title,
    ...(meta.description ? { description: meta.description } : {}),
    isPartOf: { "@id": websiteId },
    inLanguage: SITE_LANG,
    ...(updatedAt ? { dateModified: updatedAt } : {}),
    ...(meta.image ? { primaryImageOfPage: { "@id": `${pageId}-image` } } : {}),
    ...(identity && isEntityPage(page, site)
      ? { mainEntity: { "@id": identityId } }
      : {}),
  } as Thing);

  if (meta.image) {
    nodes.push({
      "@type": "ImageObject",
      "@id": `${pageId}-image`,
      url: meta.image.url,
      width: String(meta.image.width),
      height: String(meta.image.height),
      ...(meta.image.alt ? { caption: meta.image.alt } : {}),
    } as Thing);
  }

  return stegaClean({
    "@context": "https://schema.org",
    "@graph": nodes,
  }) as Graph;
}

function buildIdentity(
  site: SiteSettings,
  meta: Meta,
  id: string,
  origin: string,
): Thing | null {
  const identity = site?.siteIdentity;

  if (!identity?.name) return null;

  const sections = site?.aiContent?.sections ?? [];
  const knowsAbout = itemsFor(sections, KNOWS_ABOUT_SECTIONS);
  const award = itemsFor(sections, AWARD_SECTIONS);

  const shared = {
    "@id": id,
    name: identity.name,
    url: `${origin}/`,
    ...(identity.alternateName
      ? { alternateName: identity.alternateName }
      : {}),
    ...(site?.fallbackSEO?.metaDescription
      ? { description: site.fallbackSEO.metaDescription }
      : {}),
    ...(identity.email ? { email: identity.email } : {}),
    ...(meta.sameAs.length ? { sameAs: meta.sameAs } : {}),
    ...(knowsAbout.length ? { knowsAbout } : {}),
    ...(award.length ? { award } : {}),
  };

  const logo = identity.logo?.url;

  if (identity.entityType === "person") {
    return {
      "@type": "Person",
      ...shared,
      ...(identity.jobTitle ? { jobTitle: identity.jobTitle } : {}),
      ...(logo ? { image: logo } : {}),
    } as Person as Thing;
  }

  return {
    "@type": "Organization",
    ...shared,
    ...(logo
      ? {
          logo: {
            "@type": "ImageObject",
            url: logo,
            ...(identity.logo?.width
              ? { width: String(identity.logo.width) }
              : {}),
            ...(identity.logo?.height
              ? { height: String(identity.logo.height) }
              : {}),
          } as ImageObject,
        }
      : {}),
  } as Organization as Thing;
}

function webPageType(page: SeoPage | undefined, site: SiteSettings) {
  const isPerson = site?.siteIdentity?.entityType === "person";

  if (page?.type === "home" && isPerson) return "ProfilePage";

  return "WebPage";
}

function isEntityPage(page: SeoPage | undefined, site: SiteSettings) {
  const isPerson = site?.siteIdentity?.entityType === "person";

  return page?.type === "home" && isPerson;
}

function itemsFor(
  sections: { title: string | null; items: string[] | null }[],
  titles: string[],
): string[] {
  return sections
    .filter((section) => titles.includes((section.title ?? "").toLowerCase()))
    .flatMap((section) => section.items ?? []);
}
