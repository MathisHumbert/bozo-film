import { describe, expect, it } from "vitest";

import type { SiteSettings } from "../src/lib/sanity/types";
import { buildMeta } from "../src/lib/seo/meta";
import { resolvePaths } from "../src/pages/api/revalidate";

describe("buildMeta title", () => {
  const base = {
    canonical: "https://bozo-film.vercel.app/",
    ogType: "website" as const,
  };

  it("falls back to the site name before the boilerplate default", () => {
    const site = {
      siteIdentity: { name: "Bozo Film" },
    } as unknown as SiteSettings;

    expect(buildMeta({ ...base, site }).title).toBe("Bozo Film");
  });

  it("still prefers the page's own, then the fallback SEO title", () => {
    const site = {
      siteIdentity: { name: "Bozo Film" },
      fallbackSEO: { metaTitle: "Bozo Film — fallback" },
    } as unknown as SiteSettings;

    expect(buildMeta({ ...base, site }).title).toBe("Bozo Film — fallback");
    expect(
      buildMeta({ ...base, site, seo: { metaTitle: "Own" } as never }).title,
    ).toBe("Own");
  });
});

describe("resolvePaths", () => {
  it("purges a work page and its Markdown twin", async () => {
    const paths = await resolvePaths({ _type: "work", slug: "aurora" });

    expect(paths).toEqual(
      expect.arrayContaining(["/work/aurora", "/work/aurora.md"]),
    );
  });

  it("purges every static page and its twin for a site-wide type", async () => {
    const paths = await resolvePaths({ _type: "settings" });

    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/index.md",
        "/about",
        "/about.md",
        "/photo",
        "/photo.md",
        "/llms.txt",
        "/llms-full.txt",
      ]),
    );
  });

  it("does nothing for an unknown type", async () => {
    expect(await resolvePaths({ _type: "sanity.imageAsset" })).toEqual([]);
  });
});
