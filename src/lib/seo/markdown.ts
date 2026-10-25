import type {
  AboutQueryResult,
  AllWorkQueryResult,
  HomeQueryResult,
  LlmsQueryResult,
  PhotoQueryResult,
  WorkBySlugQueryResult,
} from "../../../sanity/sanity.types";
import { hrefFor } from "../routes";
import { urlForImage } from "../sanity/url-for-image";
import { canonicalUrl } from "./url";

// One Markdown document per page, served at `/<path>.md` and, through content
// negotiation, at the page URL itself for `Accept: text/markdown`. Same rule as
// the rest of this folder: data in, string out, nothing fetched.

type Settings = NonNullable<LlmsQueryResult>["settings"];

export interface MarkdownContext {
  site: URL;
  settings: Settings;
}

export function siteNameOf(settings: Settings): string {
  return (
    settings?.siteIdentity?.name ||
    settings?.fallbackSEO?.metaTitle ||
    "Website"
  );
}

export function renderHomeMarkdown(
  home: HomeQueryResult,
  allWork: AllWorkQueryResult | null,
  ctx: MarkdownContext,
): string {
  const name = siteNameOf(ctx.settings);
  const summary =
    home?.seo?.metaDescription ||
    ctx.settings?.aiContent?.summary ||
    ctx.settings?.fallbackSEO?.metaDescription;

  const out: string[] = [`# ${collapse(name)}`];

  if (summary) out.push(`> ${collapse(summary)}`);

  const featured = home?.featuredWork ?? [];

  if (featured.length) {
    out.push(
      section(
        "Selected works",
        featured.map((work) => workLine(work, ctx.site)),
      ),
    );
  }

  const works = allWork ?? [];

  if (works.length) {
    out.push(
      section(
        "All works",
        works.map((work) => workLine(work, ctx.site)),
      ),
    );
  }

  out.push(
    section("Pages", [
      pageLine("About", hrefFor({ _type: "about" }), ctx.site),
      pageLine("Photo", hrefFor({ _type: "photo" }), ctx.site),
    ]),
  );

  return finish(out, "/", ctx);
}

export function renderAboutMarkdown(
  about: NonNullable<AboutQueryResult>,
  ctx: MarkdownContext,
): string {
  const out: string[] = [`# ${collapse(about.title || "About")}`];

  if (about.description) out.push(paragraphs(about.description));

  if (about.services?.length) {
    out.push(section("Services", bullets(about.services)));
  }

  if (about.clients?.length) {
    out.push(section("Select clients", bullets(about.clients)));
  }

  const links = (about.socialLinks ?? []).filter((link) => link.href);

  if (links.length) {
    out.push(
      section(
        "Follow",
        links.map(
          (link) =>
            `- [${collapse(link.label)}](${absolute(link.href!, ctx.site)})`,
        ),
      ),
    );
  }

  const contact: string[] = [];

  if (about.contact?.email) {
    contact.push(
      `- Email: [${about.contact.email}](mailto:${about.contact.email})`,
    );
  }

  if (about.contact?.phone) {
    contact.push(`- Phone: ${collapse(about.contact.phone)}`);
  }

  if (contact.length) out.push(section("Contact", contact));

  const reel = [about.reel?.textTop, about.reel?.textBottom].filter(
    (text): text is string => Boolean(text),
  );

  if (reel.length) {
    out.push(
      section(
        "Showreel",
        reel.map((text) => collapse(text)),
      ),
    );
  }

  return finish(out, hrefFor({ _type: "about" }) ?? "/", ctx);
}

export function renderPhotoMarkdown(
  photo: NonNullable<PhotoQueryResult>,
  ctx: MarkdownContext,
): string {
  const out: string[] = [`# ${collapse(photo.title || "Photo")}`];

  const images = (photo.images ?? []).map((image) => {
    const url = urlForImage(image).width(1600).auto("format").url();

    return `![${collapse(image.alt ?? "")}](${url})`;
  });

  if (images.length) out.push(images.join("\n\n"));

  return finish(out, hrefFor({ _type: "photo" }) ?? "/", ctx);
}

export function renderWorkMarkdown(
  work: NonNullable<WorkBySlugQueryResult>,
  slug: string,
  ctx: MarkdownContext,
): string {
  const out: string[] = [`# ${collapse(work.title)}`];

  if (work.excerpt) out.push(paragraphs(work.excerpt));

  const details: string[] = [];

  if (work.project) details.push(`- Project: ${collapse(work.project)}`);

  if (work.category?.length) {
    details.push(`- Category: ${work.category.map(collapse).join(", ")}`);
  }

  if (work.roles?.length) {
    details.push(`- Roles: ${work.roles.map(collapse).join(", ")}`);
  }

  const duration = formatDuration(work.mainVideo?.duration);

  if (duration) details.push(`- Duration: ${duration}`);

  if (details.length) out.push(section("Details", details));

  out.push(
    section("More", [
      pageLine("All works", hrefFor({ _type: "home" }), ctx.site),
    ]),
  );

  return finish(out, hrefFor({ _type: "work", slug }) ?? "/", ctx);
}

export function renderNotFoundMarkdown(path: string, site: URL): string {
  const origin = site.origin;

  return (
    [
      "# Page not found",
      `Nothing is published at \`${path}\`. It may have moved, or the address may be mistyped.`,
      section("Where to go next", [
        `- [Home](${canonicalUrl("/", site)})`,
        `- [Site index for agents](${origin}/llms.txt)`,
        `- [Sitemap](${origin}/sitemap-index.xml)`,
      ]),
    ].join("\n\n") + "\n"
  );
}

// ——— helpers ———

interface WorkSummary {
  title: string;
  slug: string;
  mainDuration: number | null;
}

function workLine(work: WorkSummary, site: URL): string {
  const href = hrefFor({ _type: "work", slug: work.slug });
  const duration = formatDuration(work.mainDuration);
  const suffix = duration ? ` (${duration})` : "";

  return href
    ? `- [${collapse(work.title)}](${canonicalUrl(href, site)})${suffix}`
    : `- ${collapse(work.title)}${suffix}`;
}

function pageLine(label: string, path: string | null, site: URL): string {
  return path ? `- [${label}](${canonicalUrl(path, site)})` : `- ${label}`;
}

function finish(out: string[], path: string, ctx: MarkdownContext): string {
  const origin = ctx.site.origin;

  out.push(
    [
      "---",
      `${collapse(siteNameOf(ctx.settings))} · [${canonicalUrl(path, ctx.site)}](${canonicalUrl(path, ctx.site)})`,
      `Index: [${origin}/llms.txt](${origin}/llms.txt) · Sitemap: [${origin}/sitemap-index.xml](${origin}/sitemap-index.xml)`,
    ].join("\n\n"),
  );

  return `${out.join("\n\n")}\n`;
}

function section(title: string, lines: string[]): string {
  return `## ${collapse(title)}\n\n${lines.join("\n")}`;
}

function bullets(items: string[]): string[] {
  return items.filter(Boolean).map((item) => `- ${collapse(item)}`);
}

// Keeps paragraph breaks, collapses everything else.
function paragraphs(value: string): string {
  return value
    .split(/\n\s*\n/)
    .map(collapse)
    .filter(Boolean)
    .join("\n\n");
}

function absolute(href: string, site: URL): string {
  return href.startsWith("/") ? canonicalUrl(href, site) : href;
}

export function formatDuration(seconds?: number | null): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;

  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = String(total % 60).padStart(2, "0");

  return `${minutes}:${rest}`;
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
