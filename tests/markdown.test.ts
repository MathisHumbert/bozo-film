import { describe, expect, it } from "vitest";

import type {
  AboutQueryResult,
  AllWorkQueryResult,
  HomeQueryResult,
  WorkBySlugQueryResult,
} from "../sanity/sanity.types";
import {
  formatDuration,
  renderAboutMarkdown,
  renderHomeMarkdown,
  renderNotFoundMarkdown,
  renderWorkMarkdown,
  type MarkdownContext,
} from "../src/lib/seo/markdown";

const site = new URL("https://bozo-film.vercel.app");

const ctx: MarkdownContext = {
  site,
  settings: {
    siteIdentity: {
      entityType: "organization",
      name: "Bozo Film",
      jobTitle: null,
      email: null,
      sameAs: null,
    },
    aiContent: { summary: "A film  studio\nin London.", sections: null },
    fallbackSEO: null,
  },
};

const work = {
  title: "Rose Williams",
  slug: "rose-williams",
  mainDuration: 88,
};

describe("renderHomeMarkdown", () => {
  const home = {
    title: "Bozo Film",
    featuredWork: [work],
    seo: null,
  } as unknown as HomeQueryResult;

  const md = renderHomeMarkdown(
    home,
    [work] as unknown as AllWorkQueryResult,
    ctx,
  );

  it("opens with the site name as the only H1, and the summary", () => {
    expect(md.startsWith("# Bozo Film\n\n> A film studio in London.")).toBe(
      true,
    );
    expect(md.match(/^# /gm)).toHaveLength(1);
  });

  it("links every work to its canonical URL, with its duration", () => {
    expect(md).toContain(
      "- [Rose Williams](https://bozo-film.vercel.app/work/rose-williams/) (1:28)",
    );
    expect(md).toContain("## Selected works");
    expect(md).toContain("## All works");
  });

  it("points at the llms.txt index and the sitemap", () => {
    expect(md).toContain("https://bozo-film.vercel.app/llms.txt");
    expect(md).toContain("https://bozo-film.vercel.app/sitemap-index.xml");
  });

  it("renders with no Sanity data at all", () => {
    const empty = renderHomeMarkdown(null, null, { site, settings: null });

    expect(empty.startsWith("# Website")).toBe(true);
    expect(empty).toContain("## Pages");
  });
});

describe("renderAboutMarkdown", () => {
  const about = {
    title: "Bio",
    description: "First   paragraph.\n\nSecond.",
    services: ["Direction", ""],
    clients: ["Nike"],
    socialLinks: [
      { label: "Instagram", external: true, href: "https://instagram.com/x" },
      { label: "Broken", external: true, href: null },
    ],
    contact: { email: "info@bozofilm.com", phone: "+44 1" },
    reel: { textTop: "Top", textBottom: null },
  } as unknown as NonNullable<AboutQueryResult>;

  const md = renderAboutMarkdown(about, ctx);

  it("keeps paragraphs and drops empty items", () => {
    expect(md).toContain("# Bio\n\nFirst paragraph.\n\nSecond.");
    expect(md).toContain("## Services\n\n- Direction\n\n");
  });

  it("lists links that have an href, and the contact", () => {
    expect(md).toContain("- [Instagram](https://instagram.com/x)");
    expect(md).not.toContain("Broken");
    expect(md).toContain("[info@bozofilm.com](mailto:info@bozofilm.com)");
  });
});

describe("renderWorkMarkdown", () => {
  const doc = {
    title: "Kosar Ali",
    project: "Music video",
    excerpt: "Shot on 16mm.",
    category: ["Music"],
    roles: ["Direction", "Edit"],
    mainVideo: { duration: 125 },
  } as unknown as NonNullable<WorkBySlugQueryResult>;

  const md = renderWorkMarkdown(doc, "kosar-ali", ctx);

  it("renders the details the page shows", () => {
    expect(md).toContain("# Kosar Ali\n\nShot on 16mm.");
    expect(md).toContain("- Project: Music video");
    expect(md).toContain("- Roles: Direction, Edit");
    expect(md).toContain("- Duration: 2:05");
  });

  it("ends on its own canonical URL", () => {
    expect(md).toContain("https://bozo-film.vercel.app/work/kosar-ali/");
  });
});

describe("renderNotFoundMarkdown", () => {
  const md = renderNotFoundMarkdown("/__probe", site);

  it("explains the error and links to the index and the sitemap", () => {
    expect(md.startsWith("# Page not found")).toBe(true);
    expect(md).toContain("`/__probe`");
    expect(md).toContain("(https://bozo-film.vercel.app/llms.txt)");
    expect(md).toContain("(https://bozo-film.vercel.app/sitemap-index.xml)");
    expect(md.length).toBeGreaterThan(20);
  });
});

describe("formatDuration", () => {
  it.each([
    [88, "1:28"],
    [50, "0:50"],
    [125.4, "2:05"],
    [0, null],
    [null, null],
  ])("%s → %s", (seconds, expected) =>
    expect(formatDuration(seconds)).toBe(expected),
  );
});
